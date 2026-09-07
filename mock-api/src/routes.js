import { listAuditLog, logEvent, resetAuditLog } from "./auditlog.js";
import { buildEnablements, validateTimesheetEnablement } from "./enablement.js";
import { planningEntries, rules, seedOrders, timesheets } from "./fixtures.js";
import {
  checkCostObject,
  displayNameFor,
  findEmployeeByClaims,
  listAssignments,
  listCostObjects,
  listEmployees,
  listTeamAssignments,
  listTeams,
  resetMasterData,
  store as masterData,
  upsertAssignment,
  upsertCostObject,
  upsertEmployee,
  upsertTeam,
  upsertTeamAssignment,
} from "./masterdata.js";
import {
  buildOrderCandidates,
  createBanf,
  createOrder,
  runPurchaseOrderSync,
  updateOrderText,
} from "./orders.js";
import {
  buildPlanningOverview,
  isValidMonth,
  releasePlanningEntry,
  upsertPlanningEntry,
} from "./planning.js";
import { buildResourceLifecycle } from "./lifecycle.js";
import { sumHours } from "./hours.js";
import { messageFor } from "./messages.js";
import {
  validateTimesheetPayload,
  workHoursOf,
} from "./timesheet-validation.js";
import { buildBudgetMonitor, buildCostObjectQuota } from "./reporting.js";

const timesheetKey = (day) => `${day.extNr}|${day.date}`;

// Simulierte OAuth-Token-Claims (XTS-050): bis Entra ID real angebunden
// ist, kommen `oid` und `upn` als Header-Pseudo-Claims herein. Das Mapping
// auf ZXTS_WIW_T folgt der Entscheidungsvorlage: AAD_OID fuehrend, AAD_UPN
// als Fallback. Ohne Header gilt die Default-Persona SCHILZ (per UPN).
const OAUTH_OID_HEADER = "x-mock-oauth-oid";
const OAUTH_UPN_HEADER = "x-mock-oauth-upn";
const DEFAULT_UPN = "stephan.schilz@qualitytimes.de";

let timesheetStore = new Map();
let planningStore = [];
let ordersState = null;
let rulesStore = [];
let weDocumentCounter = 0;
resetTimesheetStore();

export function resetTimesheetStore() {
  timesheetStore = new Map(
    timesheets.map((day) => {
      const stored = structuredClone(day);
      stored.workHours = workHoursOf(stored);
      return [timesheetKey(day), stored];
    }),
  );
  planningStore = structuredClone(planningEntries);
  ordersState = {
    orders: structuredClone(seedOrders),
    protocol: [],
    orderCounter: 0,
    banfCounter: 0,
  };
  rulesStore = structuredClone(rules);
  weDocumentCounter = 0;
  resetMasterData();
  resetAuditLog();
}

const TIMESHEET_STATUS_LABELS = {
  E: "Entwurf",
  F: "Zur Genehmigung freigegeben",
  G: "Genehmigt",
  A: "Zurückgewiesen",
};

// Kontrakt fuer POST /odata/TimesheetDays (Statusmodell Konzept §6.2):
// Mitarbeiter schreiben nur diese Felder, alles andere fuehrt der Server.
const TIMESHEET_FIELDS = [
  "extNr",
  "date",
  "startTime",
  "endTime",
  "breakMinutes",
  "location",
  "varianceReason",
];
const TIMESHEET_LINE_FIELDS = ["coIdent", "description", "hours"];
const PROTECTED_TIMESHEET_FIELDS = [
  "approvedBy",
  "approvedAt",
  "weDocument",
  "rejectionReason",
];
const EMPLOYEE_TARGET_STATUSES = ["E", "F"];
const EMPLOYEE_EDITABLE_STATUSES = ["E", "A"];

function pickFields(source, fields) {
  const target = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) target[field] = source[field];
  }
  return target;
}

function pickTimesheetFields(body, status) {
  // Fehlende Positionen sind ein leerer Entwurf; alles andere, was keine
  // Liste ist, geht unveraendert in die Validierung (LINES_INVALID).
  const lines =
    body.lines === undefined
      ? []
      : Array.isArray(body.lines)
        ? body.lines.map((line) => pickFields(line, TIMESHEET_LINE_FIELDS))
        : body.lines;
  return { ...pickFields(body, TIMESHEET_FIELDS), status, lines };
}

function hasBookedHours(day) {
  const lines = Array.isArray(day.lines) ? day.lines : [];
  const total = sumHours(lines.map((line) => line.hours));
  return lines.length > 0 && total > 0;
}

/**
 * Liest die Claims eines Bearer-Tokens (JWT) aus dem Payload. Der Mock
 * prueft bewusst KEINE Signatur, Ausstellerin oder Ablaufzeit; das bleibt
 * dem SAP-OData-Service mit Entra-Metadaten vorbehalten.
 */
function decodeJwtClaims(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims = JSON.parse(payload);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function stringClaim(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function claimsFromRequest(request) {
  const authorization =
    stringClaim(firstHeaderValue(request.headers?.authorization)) ?? "";
  if (/^Bearer\s+/i.test(authorization)) {
    const claims = decodeJwtClaims(authorization.replace(/^Bearer\s+/i, ""));
    if (!claims) return { error: "INVALID_TOKEN" };
    const oid = stringClaim(claims.oid);
    const upn =
      stringClaim(claims.preferred_username) ??
      stringClaim(claims.upn) ??
      stringClaim(claims.email);
    if (!oid && !upn) return { error: "INVALID_TOKEN" };
    return {
      oid,
      upn,
      source: "bearer",
    };
  }
  const oid = stringClaim(
    firstHeaderValue(request.headers?.[OAUTH_OID_HEADER]),
  );
  const upn =
    stringClaim(firstHeaderValue(request.headers?.[OAUTH_UPN_HEADER])) ??
    (oid ? null : DEFAULT_UPN);
  return { oid, upn, source: "header" };
}

function resolvePersona(request) {
  const claims = claimsFromRequest(request);
  if (claims.error) {
    return { error: json({ error: claims.error }, 401) };
  }
  const { oid, upn } = claims;
  const mapping = findEmployeeByClaims({ oid, upn });
  if (!mapping) {
    return { error: json({ error: "NO_EXTNR_MAPPING", oid, upn }, 404) };
  }
  const { employee, mappedBy } = mapping;
  if (!employee.active || employee.deleted) {
    return {
      error: json({ error: "EMPLOYEE_INACTIVE", extNr: employee.extNr }, 403),
    };
  }
  return { employee, mappedBy };
}

function requireRole(persona, role) {
  if (!persona.employee.roles.includes(role)) {
    return json({ error: "NOT_AUTHORIZED", requiredRole: role }, 403);
  }
  return null;
}

function requireApprover(persona) {
  return requireRole(persona, "approver");
}

function hasRole(persona, role) {
  return persona.employee.roles.includes(role);
}

function hasAnyRole(persona, roles) {
  return roles.some((role) => hasRole(persona, role));
}

function requireAnyRole(persona, roles) {
  if (!hasAnyRole(persona, roles)) {
    return json(
      { error: "NOT_AUTHORIZED", requiredRole: roles.join("|") },
      403,
    );
  }
  return null;
}

/** Mitarbeiterdaten ohne Zugangs- und Personaldetails (fuer Nicht-Admins). */
function publicEmployee(employee) {
  const { extNr, displayName, firstName, lastName, company, active } = employee;
  return { extNr, displayName, firstName, lastName, company, active };
}

export async function routeRequest(request) {
  const url = new URL(request.url, "http://127.0.0.1");
  const path = url.pathname.replace(/\/$/, "");

  if (path === "/health") {
    // Antwortform (Entscheidung 17), damit ein wiederverwendeter Server in den
    // Smoke-Tests gegen die erwartete Form geprueft werden kann.
    const odata = process.env.XTS_ODATA === "v2" ? "v2" : "mock";
    return json({ status: "ok", odata });
  }

  // Stammdaten lesen (Audit Nr. 6): immer angemeldet, Umfang nach Rolle.
  // Nur `admin` sieht Zugangs- und Personaldetails (aadOid, aadUpn,
  // sapAccount, resourceManager, roles) sowie geloeschte/inaktive Saetze.
  if (request.method === "GET" && path === "/odata/Employees") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    const isAdmin = hasRole(persona, "admin");
    if (includeDeleted && !isAdmin) {
      return json({ error: "NOT_AUTHORIZED", requiredRole: "admin" }, 403);
    }
    const employees = listEmployees({ includeDeleted });
    if (isAdmin) return json({ value: employees });
    // Nicht-Admins sehen nur aktive, nicht geloeschte Mitarbeiter.
    const active = employees.filter((item) => item.active);
    const visible = hasAnyRole(persona, ["planner", "approver"])
      ? active
      : active.filter((item) => item.extNr === persona.employee.extNr);
    return json({ value: visible.map(publicEmployee) });
  }

  if (request.method === "GET" && path === "/odata/Teams") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    if (includeInactive && !hasRole(persona, "admin")) {
      return json({ error: "NOT_AUTHORIZED", requiredRole: "admin" }, 403);
    }
    return json({ value: listTeams({ includeInactive }) });
  }

  if (request.method === "GET" && path === "/odata/CostObjects") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    if (includeDeleted && !hasRole(persona, "admin")) {
      return json({ error: "NOT_AUTHORIZED", requiredRole: "admin" }, 403);
    }
    return json({ value: listCostObjects({ includeDeleted }) });
  }

  if (request.method === "GET" && path === "/odata/TeamAssignments") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireAnyRole(persona, ["admin", "planner"]);
    if (roleError) return roleError;
    return json({
      value: listTeamAssignments().map((item) => ({
        ...item,
        displayName: displayNameFor(item.extNr),
      })),
    });
  }

  if (request.method === "GET" && path === "/odata/CostObjectAssignments") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireAnyRole(persona, ["admin", "planner"]);
    if (roleError) return roleError;
    return json({
      value: listAssignments().map((item) => ({
        ...item,
        displayName: displayNameFor(item.extNr),
      })),
    });
  }

  // Testdatenpaket (XTS-082): setzt Stamm- und Bewegungsdaten auf den
  // dokumentierten UAT-Ausgangsstand zurueck (docs/testdaten-uat-v0.1.md).
  if (request.method === "POST" && path === "/odata/TestDataResets") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    resetTimesheetStore();
    logEvent({
      actor: persona.employee.extNr,
      category: "system",
      object: "testdata",
      objectKey: "uat-v0.1",
      message: "Testdatenpaket uat-v0.1 zurückgesetzt.",
    });
    return json({
      package: "uat-v0.1",
      resetBy: persona.employee.extNr,
      resetAt: new Date().toISOString(),
      counts: {
        employees: masterData.employees.length,
        teams: masterData.teams.length,
        costObjects: masterData.costObjects.length,
        assignments: masterData.assignments.length,
        planningEntries: planningStore.length,
        orders: ordersState.orders.length,
        timesheetDays: timesheetStore.size,
      },
    });
  }

  if (request.method === "GET" && path === "/odata/AuditLog") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    const value = listAuditLog({
      category: url.searchParams.get("category") ?? "",
      severity: url.searchParams.get("severity") ?? "",
      object: url.searchParams.get("object") ?? "",
      actor: url.searchParams.get("actor") ?? "",
      q: url.searchParams.get("q") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      limit: url.searchParams.get("limit") ?? "",
    });
    return json({ value });
  }

  if (request.method === "POST" && path === "/odata/CostObjectChecks") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    return json(checkCostObject(await readJsonBody(request)));
  }

  const masterDataWrites = {
    "/odata/Employees": [upsertEmployee, "employee", "Mitarbeiter", "extNr"],
    "/odata/Teams": [upsertTeam, "team", "Team", "id"],
    "/odata/TeamAssignments": [
      upsertTeamAssignment,
      "assignment",
      "Teamzuordnung",
      "id",
    ],
    "/odata/CostObjects": [
      upsertCostObject,
      "costObject",
      "Kontierung",
      "coIdent",
    ],
    "/odata/CostObjectAssignments": [
      upsertAssignment,
      "assignment",
      "Mitarbeiter-Kontierung",
      "id",
    ],
  };
  if (request.method === "POST" && masterDataWrites[path]) {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    const [upsert, key, object, keyField] = masterDataWrites[path];
    const result = upsert(await readJsonBody(request), persona.employee.extNr);
    if (result.error) {
      const { status, ...details } = result.error;
      return json({ error: details.code, ...details }, status);
    }
    const record = result[key];
    logEvent({
      actor: persona.employee.extNr,
      category: "masterdata",
      object,
      objectKey: record[keyField],
      to: record.deleted ? "gelöscht" : "gespeichert",
      message: `${object} ${record[keyField]} ${record.deleted ? "logisch gelöscht" : "gespeichert"}.`,
    });
    return json(record);
  }

  if (request.method === "GET" && path === "/odata/MyProfile") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const { extNr, displayName, company, roles, aadUpn } = persona.employee;
    return json({
      extNr,
      displayName,
      company,
      roles,
      aadUpn,
      mappedBy: persona.mappedBy,
    });
  }

  if (request.method === "GET" && path === "/odata/MyEnabledCostObjects") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const value = buildEnablements(
      ordersState.orders,
      [...timesheetStore.values()],
      rulesStore,
    ).filter((item) => item.extNr === persona.employee.extNr);
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/Rules") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    return json({ value: rulesStore.map((rule) => ({ ...rule })) });
  }

  if (request.method === "POST" && path === "/odata/Rules") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "admin");
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    const allowedValues = { 1: ["MA_KONT"], 2: ["P", "B"] };
    const allowed = allowedValues[body.infotype];
    if (
      !allowed ||
      !allowed.includes(body.value) ||
      typeof body.active !== "boolean"
    ) {
      return json({ error: "INVALID_RULE" }, 400);
    }
    const rule = rulesStore.find(
      (candidate) => candidate.infotype === body.infotype,
    );
    const before = { value: rule.value, active: rule.active };
    rule.value = body.value;
    rule.active = body.active;
    logEvent({
      actor: persona.employee.extNr,
      category: "rule",
      object: "rule",
      objectKey: `Infotyp ${rule.infotype}`,
      from: `${before.value}/${before.active ? "aktiv" : "inaktiv"}`,
      to: `${rule.value}/${rule.active ? "aktiv" : "inaktiv"}`,
      message: `Regel Infotyp ${rule.infotype} geändert.`,
    });
    return json({ ...rule });
  }

  if (request.method === "GET" && path === "/odata/MyTimesheets") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const date = url.searchParams.get("date");
    const value = [...timesheetStore.values()]
      .filter((day) => day.extNr === persona.employee.extNr)
      .filter((day) => !date || day.date === date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/ApprovalTimesheets") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireApprover(persona);
    if (roleError) return roleError;
    const month = url.searchParams.get("month");
    const extNr = url.searchParams.get("extNr");
    const value = [...timesheetStore.values()]
      .filter((day) => day.status === "F")
      .filter((day) => !month || day.date.startsWith(month))
      .filter((day) => !extNr || day.extNr === extNr)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.extNr.localeCompare(b.extNr),
      )
      .map((day) => ({ ...day, displayName: displayNameFor(day.extNr) }));
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/PlanningOverview") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const start = url.searchParams.get("start") ?? "2026-03";
    if (!isValidMonth(start)) {
      return json({ error: "INVALID_START_MONTH", start }, 400);
    }
    return json(
      buildPlanningOverview(planningStore, {
        start,
        extNr: url.searchParams.get("extNr") ?? "",
        team: url.searchParams.get("team") ?? "",
        coIdent: url.searchParams.get("coIdent") ?? "",
      }),
    );
  }

  if (request.method === "POST" && path === "/odata/PlanningEntries") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    const result = upsertPlanningEntry(planningStore, body);
    if (result.error) {
      return json({ error: result.error.code }, result.error.status);
    }
    return json(result, 201);
  }

  if (request.method === "POST" && path === "/odata/PlanningReleases") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    const result = releasePlanningEntry(planningStore, body);
    if (result.error) {
      return json({ error: result.error.code }, result.error.status);
    }
    logEvent({
      actor: persona.employee.extNr,
      category: "status",
      object: "planning",
      objectKey: `${result.entry.extNr}/${result.entry.coIdent}/${result.entry.month}`,
      from: "V",
      to: "F",
      message: `Planzeile für BANF freigegeben (${result.entry.hours} Std.).`,
    });
    return json(result);
  }

  if (request.method === "GET" && path === "/odata/OrderCandidates") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const value = buildOrderCandidates(
      planningStore,
      ordersState.orders,
      {
        extNr: url.searchParams.get("extNr") ?? "",
        coIdent: url.searchParams.get("coIdent") ?? "",
        from: url.searchParams.get("from") ?? "",
        to: url.searchParams.get("to") ?? "",
      },
      rulesStore,
    );
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/Orders") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    return json({ value: ordersState.orders.map((order) => ({ ...order })) });
  }

  if (request.method === "POST" && path === "/odata/Orders") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    const result = body.orderId
      ? updateOrderText(ordersState, body)
      : createOrder(ordersState, planningStore, body);
    if (result.error) {
      return json({ error: result.error.code }, result.error.status);
    }
    if (!body.orderId) {
      logEvent({
        actor: persona.employee.extNr,
        category: "status",
        object: "order",
        objectKey: result.order.orderId,
        from: null,
        to: "created",
        message: `Beauftragung ${result.order.orderId} für ${result.order.displayName} angelegt (${result.order.hours} Std., Planung ${result.order.planningRefs.join(", ")}).`,
      });
    }
    return json(result.order, body.orderId ? 200 : 201);
  }

  if (request.method === "POST" && path === "/odata/OrderBanfs") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    const result = createBanf(ordersState, planningStore, body);
    if (result.error) {
      if (result.error.code === "BANF_ALREADY_EXISTS") {
        logEvent({
          actor: persona.employee.extNr,
          category: "job",
          severity: "error",
          object: "order",
          objectKey: body.orderId,
          message: `BANF-Anlage abgelehnt: Beauftragung ${body.orderId} hat bereits eine BANF.`,
          details: { source: "banf", code: result.error.code },
        });
      }
      return json({ error: result.error.code }, result.error.status);
    }
    logEvent({
      actor: persona.employee.extNr,
      category: "status",
      object: "order",
      objectKey: result.order.orderId,
      from: "created",
      to: "banf",
      message: `BANF ${result.order.banfNumber}/${result.order.banfItem} zu ${result.order.orderId} angelegt, Planung auf P gesetzt.`,
      details: { banfNumber: result.order.banfNumber },
    });
    return json(result.order, 201);
  }

  if (request.method === "POST" && path === "/odata/PurchaseOrderSyncRuns") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    const result = runPurchaseOrderSync(ordersState, planningStore);
    for (const order of result.updatedOrders) {
      logEvent({
        actor: persona.employee.extNr,
        category: "status",
        object: "order",
        objectKey: order.orderId,
        from: "banf",
        to: "bestellt",
        message: `Bestelldaten-Job: Bestellung ${order.ebeln}/${order.ebelp} zu ${order.orderId} übernommen, Planung auf B gesetzt.`,
        details: { source: "po-sync", ebeln: order.ebeln, ebelp: order.ebelp },
      });
    }
    for (const entry of result.errors) {
      const order = ordersState.orders.find(
        (candidate) => candidate.orderId === entry.orderId,
      );
      logEvent({
        actor: persona.employee.extNr,
        category: "job",
        severity: "error",
        object: "order",
        objectKey: entry.orderId,
        message: `Bestelldaten-Job: ${entry.message}`,
        details: {
          source: "po-sync",
          banfNumber: order?.banfNumber ?? null,
          coIdent: order?.coIdent ?? null,
        },
      });
    }
    const { updatedOrders, ...response } = result;
    return json(response);
  }

  if (request.method === "GET" && path === "/odata/OrderProtocol") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    return json({ value: ordersState.protocol.map((entry) => ({ ...entry })) });
  }

  if (request.method === "GET" && path === "/odata/BudgetMonitor") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireApprover(persona);
    if (roleError) return roleError;
    const detail = url.searchParams.get("detail") ?? "none";
    const value = buildBudgetMonitor(
      [...timesheetStore.values()],
      detail,
      ordersState.orders,
      rulesStore,
    );
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/CostObjectQuota") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireApprover(persona);
    if (roleError) return roleError;
    const value = buildCostObjectQuota(
      [...timesheetStore.values()],
      {
        lastName: url.searchParams.get("lastName") ?? "",
        team: url.searchParams.get("team") ?? "",
        from: url.searchParams.get("from") ?? "",
        to: url.searchParams.get("to") ?? "",
        detail: url.searchParams.get("detail") ?? "none",
      },
      ordersState.orders,
      rulesStore,
    );
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/ResourceLifecycle") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireApprover(persona);
    if (roleError) return roleError;
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if ((from && !isValidMonth(from)) || (to && !isValidMonth(to))) {
      return json({ error: "INVALID_LIFECYCLE_PERIOD", from, to }, 400);
    }
    if (from && to && from > to) {
      return json({ error: "INVALID_LIFECYCLE_PERIOD", from, to }, 400);
    }
    const value = buildResourceLifecycle(
      planningStore,
      ordersState.orders,
      [...timesheetStore.values()],
      {
        from,
        to,
        ebeln: url.searchParams.get("ebeln") ?? "",
        ebelp: url.searchParams.get("ebelp") ?? "",
      },
    );
    return json({ value });
  }

  if (request.method === "POST" && path === "/odata/TimesheetApprovals") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireApprover(persona);
    if (roleError) return roleError;
    const body = await readJsonBody(request);
    if (!body.extNr || !body.date || !body.action) {
      return json({ error: "APPROVAL_FIELDS_REQUIRED" }, 400);
    }
    if (!["approve", "reject"].includes(body.action)) {
      return json({ error: "INVALID_APPROVAL_ACTION" }, 400);
    }
    const day = timesheetStore.get(timesheetKey(body));
    if (!day) {
      return json({ error: "TIMESHEET_NOT_FOUND" }, 404);
    }
    if (day.status !== "F") {
      return json(
        { error: "TIMESHEET_NOT_SUBMITTED", status: day.status },
        409,
      );
    }
    // Vier-Augen-Prinzip (Audit Nr. 7): niemand genehmigt eigene Tage.
    if (day.extNr === persona.employee.extNr) {
      return json({ error: "SELF_APPROVAL" }, 403);
    }
    if (body.action === "approve") {
      if (!hasBookedHours(day)) {
        return json({ error: "TIMESHEET_EMPTY" }, 409);
      }
      day.status = "G";
      day.rejectionReason = undefined;
      day.approvedBy = persona.employee.extNr;
      day.approvedAt = new Date().toISOString();
      weDocumentCounter += 1;
      day.weDocument = `WE-${String(weDocumentCounter).padStart(6, "0")}`;
      logEvent({
        actor: persona.employee.extNr,
        category: "status",
        object: "timesheet",
        objectKey: `${day.extNr}/${day.date}`,
        from: "F",
        to: "G",
        message: `Tag ${day.date} von ${displayNameFor(day.extNr)} genehmigt, Wareneingang ${day.weDocument} gebucht.`,
        details: { weDocument: day.weDocument },
      });
      return json(structuredClone(day));
    }
    if (body.action === "reject") {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) {
        return json({ error: "REJECTION_REASON_REQUIRED" }, 400);
      }
      day.status = "A";
      day.rejectionReason = reason;
      day.approvedBy = undefined;
      day.approvedAt = undefined;
      logEvent({
        actor: persona.employee.extNr,
        category: "status",
        object: "timesheet",
        objectKey: `${day.extNr}/${day.date}`,
        from: "F",
        to: "A",
        message: `Tag ${day.date} von ${displayNameFor(day.extNr)} zurückgewiesen: ${reason}`,
        details: { reason },
      });
      return json(structuredClone(day));
    }
    return json({ error: "INVALID_APPROVAL_ACTION" }, 400);
  }

  if (request.method === "POST" && path === "/odata/TimesheetDays") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const body = await readJsonBody(request);
    if (!body.extNr || !body.date) {
      return json({ error: "TIMESHEET_KEY_REQUIRED" }, 400);
    }
    if (body.extNr !== persona.employee.extNr) {
      return json({ error: "NOT_AUTHORIZED", reason: "foreign extNr" }, 403);
    }
    // Statusmaschine (Audit Nr. 1, 8): Mitarbeiter setzen nur E oder F,
    // servergefuehrte Felder sind tabu, F und G sind fuer Mitarbeiter
    // gesperrt, A darf korrigiert werden (A -> E/F loescht den Grund).
    const protectedFields = PROTECTED_TIMESHEET_FIELDS.filter(
      (field) => body[field] !== undefined,
    );
    if (protectedFields.length > 0) {
      return json({ error: "PROTECTED_FIELDS", fields: protectedFields }, 400);
    }
    const status = body.status ?? "E";
    if (!EMPLOYEE_TARGET_STATUSES.includes(status)) {
      return json(
        { error: "INVALID_STATUS", status, allowed: EMPLOYEE_TARGET_STATUSES },
        400,
      );
    }
    const previous = timesheetStore.get(timesheetKey(body));
    if (previous && !EMPLOYEE_EDITABLE_STATUSES.includes(previous.status)) {
      return json({ error: "TIMESHEET_LOCKED", status: previous.status }, 409);
    }
    const saved = pickTimesheetFields(body, status);
    const problems = validateTimesheetPayload(saved, status);
    if (problems.length > 0) {
      return json(
        {
          error: "INVALID_TIMESHEET",
          message: problems[0].message,
          fields: problems.map((item) => item.field),
          problems,
        },
        400,
      );
    }
    if (status === "F" && !hasBookedHours(saved)) {
      return json({ error: "SUBMIT_REQUIRES_HOURS" }, 409);
    }
    // Servergefuehrte Arbeitszeit (ZXTS_TIME_T-ARBEITSZEIT); leere
    // Begruendung wird nicht gespeichert.
    saved.workHours = workHoursOf(saved);
    if (typeof saved.varianceReason === "string") {
      saved.varianceReason = saved.varianceReason.trim();
      if (!saved.varianceReason) delete saved.varianceReason;
    }
    const enablementError = validateTimesheetEnablement(
      saved,
      [...timesheetStore.values()],
      ordersState.orders,
      rulesStore,
    );
    if (enablementError) {
      const { status: errorStatus, code, ...details } = enablementError;
      return json({ error: code, ...details }, errorStatus);
    }
    timesheetStore.set(timesheetKey(saved), saved);
    if (previous?.status !== saved.status) {
      logEvent({
        actor: persona.employee.extNr,
        category: "status",
        object: "timesheet",
        objectKey: `${saved.extNr}/${saved.date}`,
        from: previous?.status ?? null,
        to: saved.status,
        message: `Tag ${saved.date}: ${TIMESHEET_STATUS_LABELS[saved.status] ?? saved.status}${previous ? ` (vorher ${TIMESHEET_STATUS_LABELS[previous.status] ?? previous.status})` : ""}.`,
      });
    }
    return json(saved, 201);
  }

  return json({ error: "Not found", path }, 404);
}

export function json(payload, status = 200) {
  if (status >= 400 && typeof payload?.error === "string" && !payload.message) {
    payload = { ...payload, message: messageFor(payload.error, payload) };
  }
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": `content-type,authorization,${OAUTH_OID_HEADER},${OAUTH_UPN_HEADER}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ),
  ).toString("utf8");
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    throw new InvalidJsonError();
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super("INVALID_JSON");
    this.name = "InvalidJsonError";
  }
}
