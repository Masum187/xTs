import { buildEnablements, validateTimesheetEnablement } from "./enablement.js";
import {
  costObjects,
  employees,
  oauthMappings,
  planningEntries,
  rules,
  seedOrders,
  teams,
  timesheets,
} from "./fixtures.js";
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
import { buildBudgetMonitor, buildCostObjectQuota } from "./reporting.js";

const timesheetKey = (day) => `${day.extNr}|${day.date}`;

// Simulierter OAuth-Claim: bis XTS-050 real angebunden ist, kommt der
// angemeldete Benutzer als Header-Pseudo-Claim herein (Default: SCHILZ).
const OAUTH_HEADER = "x-mock-oauth-upn";
const DEFAULT_UPN = "stephan.schilz@qualitytimes.de";

let timesheetStore = new Map();
let planningStore = [];
let ordersState = null;
let rulesStore = [];
let weDocumentCounter = 0;
resetTimesheetStore();

export function resetTimesheetStore() {
  timesheetStore = new Map(
    timesheets.map((day) => [timesheetKey(day), structuredClone(day)]),
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
}

function displayNameFor(extNr) {
  return (
    employees.find((employee) => employee.extNr === extNr)?.displayName ?? extNr
  );
}

function resolvePersona(request) {
  const upn = request.headers?.[OAUTH_HEADER] ?? DEFAULT_UPN;
  const mapping = oauthMappings.find((entry) => entry.upn === upn);
  if (!mapping?.extNr) {
    return { error: json({ error: "NO_EXTNR_MAPPING", upn }, 404) };
  }
  const employee = employees.find((entry) => entry.extNr === mapping.extNr);
  if (!employee) {
    return { error: json({ error: "NO_EXTNR_MAPPING", upn }, 404) };
  }
  if (!employee.active) {
    return {
      error: json({ error: "EMPLOYEE_INACTIVE", extNr: employee.extNr }, 403),
    };
  }
  return { employee };
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

export async function routeRequest(request) {
  const url = new URL(request.url, "http://127.0.0.1");
  const path = url.pathname.replace(/\/$/, "");

  if (path === "/health") {
    return json({ status: "ok" });
  }

  if (request.method === "GET" && path === "/odata/Employees") {
    return json({ value: employees });
  }

  if (request.method === "GET" && path === "/odata/Teams") {
    return json({ value: teams });
  }

  if (request.method === "GET" && path === "/odata/CostObjects") {
    return json({ value: costObjects });
  }

  if (request.method === "GET" && path === "/odata/MyProfile") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const { extNr, displayName, company, roles } = persona.employee;
    return json({ extNr, displayName, company, roles });
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
    rule.value = body.value;
    rule.active = body.active;
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
      return json({ error: result.error.code }, result.error.status);
    }
    return json(result.order, 201);
  }

  if (request.method === "POST" && path === "/odata/PurchaseOrderSyncRuns") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const roleError = requireRole(persona, "planner");
    if (roleError) return roleError;
    return json(runPurchaseOrderSync(ordersState, planningStore));
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
    const value = buildResourceLifecycle(
      planningStore,
      ordersState.orders,
      [...timesheetStore.values()],
      {
        from: url.searchParams.get("from") ?? "",
        to: url.searchParams.get("to") ?? "",
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
      return json({ error: "extNr, date and action are required" }, 400);
    }
    const day = timesheetStore.get(timesheetKey(body));
    if (!day) {
      return json({ error: "Timesheet day not found" }, 404);
    }
    if (day.status !== "F") {
      return json(
        { error: "Only submitted days (status F) can be processed" },
        409,
      );
    }
    if (body.action === "approve") {
      day.status = "G";
      day.rejectionReason = undefined;
      day.approvedBy = persona.employee.extNr;
      day.approvedAt = new Date().toISOString();
      weDocumentCounter += 1;
      day.weDocument = `WE-${String(weDocumentCounter).padStart(6, "0")}`;
      return json(structuredClone(day));
    }
    if (body.action === "reject") {
      if (!body.reason) {
        return json({ error: "reason is required for rejection" }, 400);
      }
      day.status = "A";
      day.rejectionReason = body.reason;
      day.approvedBy = undefined;
      day.approvedAt = undefined;
      return json(structuredClone(day));
    }
    return json({ error: "action must be approve or reject" }, 400);
  }

  if (request.method === "POST" && path === "/odata/TimesheetDays") {
    const persona = resolvePersona(request);
    if (persona.error) return persona.error;
    const body = await readJsonBody(request);
    if (!body.extNr || !body.date) {
      return json({ error: "extNr and date are required" }, 400);
    }
    if (body.extNr !== persona.employee.extNr) {
      return json({ error: "NOT_AUTHORIZED", reason: "foreign extNr" }, 403);
    }
    const saved = structuredClone(body);
    const enablementError = validateTimesheetEnablement(
      saved,
      [...timesheetStore.values()],
      ordersState.orders,
      rulesStore,
    );
    if (enablementError) {
      return json(
        {
          error: enablementError.code,
          coIdent: enablementError.coIdent,
        },
        enablementError.status,
      );
    }
    timesheetStore.set(timesheetKey(saved), saved);
    return json(saved, 201);
  }

  return json({ error: "Not found", path }, 404);
}

export function json(payload, status = 200) {
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": `content-type,${OAUTH_HEADER}`,
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
  return body ? JSON.parse(body) : {};
}
