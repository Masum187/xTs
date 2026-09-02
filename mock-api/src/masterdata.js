import {
  assignments as assignmentFixtures,
  costObjects as costObjectFixtures,
  employees as employeeFixtures,
  sapCostObjectStub,
  teamAssignments as teamAssignmentFixtures,
  teams as teamFixtures,
} from "./fixtures.js";

// Stammdaten (Epic 2) analog ZXTS_WIW_T (Mitarbeiter), ZXTS_TEAM_T (Teams),
// ZXTS_MATEAM_T (zeitliche Teamzuordnung), ZXTS_KONT_T (Kontierungen) sowie
// die Mitarbeiter-Kontierungs-Zuordnung als Planungsbasis. Loeschen ist immer
// logisch (`deleted`); Aenderer und Aenderungszeitpunkt werden bei jedem
// Schreiben gesetzt. Alle Konsumenten (Planung, Freischaltung, Reporting)
// lesen aus diesem Store, damit Pflegeaenderungen sofort wirken.

export const COST_OBJECT_TYPES = ["KS", "OR", "PR", "FB", "KL"];

export const store = {
  employees: [],
  teams: [],
  teamAssignments: [],
  costObjects: [],
  assignments: [],
  counters: { teamAssignment: 0, costObject: 0, assignment: 0 },
};

export function resetMasterData() {
  store.employees = structuredClone(employeeFixtures);
  store.teams = structuredClone(teamFixtures);
  store.teamAssignments = structuredClone(teamAssignmentFixtures);
  store.costObjects = structuredClone(costObjectFixtures);
  store.assignments = structuredClone(assignmentFixtures);
  store.counters = {
    teamAssignment: store.teamAssignments.length,
    costObject: store.costObjects.length,
    assignment: store.assignments.length,
  };
}
resetMasterData();

const isDeleted = (item) => item.deleted === true;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

function overlaps(a, b) {
  return a.validFrom <= b.validTo && b.validFrom <= a.validTo;
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stamp(record, changedBy) {
  record.changedBy = changedBy;
  record.changedAt = new Date().toISOString();
  return record;
}

// --- Lesezugriffe --------------------------------------------------------

export function findEmployee(extNr) {
  return store.employees.find(
    (employee) => employee.extNr === extNr && !isDeleted(employee),
  );
}

export function displayNameFor(extNr) {
  return (
    store.employees.find((employee) => employee.extNr === extNr)?.displayName ??
    extNr
  );
}

export function listEmployees({ includeDeleted = false } = {}) {
  return store.employees.filter(
    (employee) => includeDeleted || !isDeleted(employee),
  );
}

export function listTeams({ includeInactive = false } = {}) {
  return store.teams.filter(
    (team) => includeInactive || (team.active && !isDeleted(team)),
  );
}

export function findTeam(teamId) {
  return store.teams.find((team) => team.id === teamId && !isDeleted(team));
}

export function listTeamAssignments() {
  return store.teamAssignments.filter((item) => !isDeleted(item));
}

/** Teams eines Mitarbeiters, deren Zuordnung den Zeitraum ueberschneidet. */
export function teamIdsFor(extNr, validFrom, validTo) {
  return listTeamAssignments()
    .filter(
      (item) => item.extNr === extNr && overlaps(item, { validFrom, validTo }),
    )
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .map((item) => item.teamId);
}

export function findCostObject(coIdent) {
  return store.costObjects.find(
    (item) => item.coIdent === coIdent && !isDeleted(item),
  );
}

export function costObjectDescription(coIdent) {
  return (
    store.costObjects.find((item) => item.coIdent === coIdent)?.description ??
    coIdent
  );
}

export function listCostObjects({ includeDeleted = false } = {}) {
  return store.costObjects.filter((item) => includeDeleted || !isDeleted(item));
}

/** Zuordnungen, deren Mitarbeiter und Kontierung nicht geloescht sind. */
export function availableAssignments() {
  return store.assignments.filter(
    (item) =>
      !isDeleted(item) &&
      findEmployee(item.extNr) &&
      findCostObject(item.coIdent),
  );
}

export function listAssignments({ includeDeleted = false } = {}) {
  return store.assignments.filter((item) => includeDeleted || !isDeleted(item));
}

// --- Mitarbeiter (XTS-010) -------------------------------------------------

export function upsertEmployee(payload, changedBy) {
  const extNr = trimmed(payload.extNr).toUpperCase();
  const firstName = trimmed(payload.firstName);
  const lastName = trimmed(payload.lastName);
  const missing = [];
  if (!extNr) missing.push("EXTNR");
  if (!lastName) missing.push("NACHNAME");
  if (!firstName) missing.push("VORNAME");
  if (typeof payload.active !== "boolean") missing.push("STATUS");
  if (missing.length > 0) {
    return {
      error: { status: 400, code: "INVALID_EMPLOYEE", fields: missing },
    };
  }
  const resourceManager = trimmed(payload.resourceManager).toUpperCase();
  if (resourceManager && !findEmployee(resourceManager)) {
    return { error: { status: 400, code: "UNKNOWN_RESOURCE_MANAGER" } };
  }
  const existing = store.employees.find((item) => item.extNr === extNr);
  const employee = existing ?? {
    extNr,
    company: "",
    sapAccount: null,
    roles: ["user"],
  };
  employee.firstName = firstName;
  employee.lastName = lastName;
  employee.displayName = `${firstName} ${lastName}`;
  employee.company = trimmed(payload.company) || employee.company;
  employee.sapAccount = trimmed(payload.sapAccount) || null;
  employee.resourceManager = resourceManager || null;
  employee.active = payload.active;
  employee.deleted = payload.deleted === true;
  stamp(employee, changedBy);
  if (!existing) store.employees.push(employee);
  return { employee: { ...employee } };
}

// --- Teams (XTS-011) -------------------------------------------------------

export function upsertTeam(payload, changedBy) {
  const id = trimmed(payload.id).toUpperCase();
  const name = trimmed(payload.name);
  const missing = [];
  if (!id) missing.push("ID");
  if (!name) missing.push("NAME");
  if (typeof payload.active !== "boolean") missing.push("STATUS");
  if (missing.length > 0) {
    return { error: { status: 400, code: "INVALID_TEAM", fields: missing } };
  }
  const existing = store.teams.find((item) => item.id === id);
  const team = existing ?? { id };
  team.name = name;
  team.active = payload.active;
  team.deleted = payload.deleted === true;
  stamp(team, changedBy);
  if (!existing) store.teams.push(team);
  return { team: { ...team } };
}

// --- Teamzuordnung (XTS-012) ----------------------------------------------

function validateValidity(payload, code) {
  const missing = [];
  if (!isValidDate(payload.validFrom)) missing.push("GUELTIG_VON");
  if (!isValidDate(payload.validTo)) missing.push("GUELTIG_BIS");
  if (missing.length > 0) {
    return { status: 400, code, fields: missing };
  }
  if (payload.validFrom > payload.validTo) {
    return { status: 400, code, fields: ["GUELTIG_VON", "GUELTIG_BIS"] };
  }
  return null;
}

export function upsertTeamAssignment(payload, changedBy) {
  const extNr = trimmed(payload.extNr).toUpperCase();
  const teamId = trimmed(payload.teamId).toUpperCase();
  if (!extNr || !teamId) {
    return {
      error: {
        status: 400,
        code: "INVALID_TEAM_ASSIGNMENT",
        fields: [!extNr && "EXTNR", !teamId && "TEAM"].filter(Boolean),
      },
    };
  }
  const validityError = validateValidity(payload, "INVALID_TEAM_ASSIGNMENT");
  if (validityError) return { error: validityError };
  if (!findEmployee(extNr)) {
    return { error: { status: 404, code: "UNKNOWN_EMPLOYEE" } };
  }
  const team = findTeam(teamId);
  if (!team?.active) {
    return { error: { status: 409, code: "TEAM_NOT_AVAILABLE" } };
  }
  const existing = payload.id
    ? store.teamAssignments.find((item) => item.id === payload.id)
    : null;
  if (payload.id && !existing) {
    return { error: { status: 404, code: "TEAM_ASSIGNMENT_NOT_FOUND" } };
  }
  const deleted = payload.deleted === true;
  const candidate = { validFrom: payload.validFrom, validTo: payload.validTo };
  const conflict =
    !deleted &&
    listTeamAssignments().find(
      (item) =>
        item !== existing && item.extNr === extNr && overlaps(item, candidate),
    );
  if (conflict) {
    return {
      error: {
        status: 409,
        code: "TEAM_ASSIGNMENT_OVERLAP",
        conflictId: conflict.id,
      },
    };
  }
  let assignment = existing;
  if (!assignment) {
    store.counters.teamAssignment += 1;
    assignment = {
      id: `MT-${String(store.counters.teamAssignment).padStart(6, "0")}`,
    };
    store.teamAssignments.push(assignment);
  }
  Object.assign(assignment, {
    extNr,
    teamId,
    validFrom: payload.validFrom,
    validTo: payload.validTo,
    deleted,
  });
  stamp(assignment, changedBy);
  return { assignment: { ...assignment } };
}

// --- Kontierungen (XTS-013) ----------------------------------------------

export function upsertCostObject(payload, changedBy) {
  const coIdent = trimmed(payload.coIdent);
  const type = trimmed(payload.type).toUpperCase();
  const description = trimmed(payload.description);
  const missing = [];
  if (!coIdent) missing.push("KONTIERUNG");
  if (!description) missing.push("BEZEICHNUNG");
  if (typeof payload.active !== "boolean") missing.push("STATUS");
  if (missing.length > 0) {
    return {
      error: { status: 400, code: "INVALID_COST_OBJECT", fields: missing },
    };
  }
  if (!COST_OBJECT_TYPES.includes(type)) {
    return {
      error: {
        status: 400,
        code: "INVALID_COST_OBJECT_TYPE",
        allowed: COST_OBJECT_TYPES,
      },
    };
  }
  const existing = store.costObjects.find((item) => item.coIdent === coIdent);
  let costObject = existing;
  if (!costObject) {
    store.counters.costObject += 1;
    costObject = {
      id: String(store.counters.costObject).padStart(6, "0"),
      coIdent,
    };
    store.costObjects.push(costObject);
  }
  costObject.type = type;
  costObject.description = description;
  costObject.active = payload.active;
  costObject.deleted = payload.deleted === true;
  stamp(costObject, changedBy);
  return { costObject: { ...costObject } };
}

/** Stub der Gueltigkeitspruefung gegen SAP CO (Phase 1). */
export function checkCostObject(payload) {
  const coIdent = trimmed(payload.coIdent);
  const type = trimmed(payload.type).toUpperCase();
  const knownType = sapCostObjectStub[coIdent];
  if (!knownType) {
    return {
      coIdent,
      type,
      valid: false,
      source: "SAP-CO-Stub",
      message: `Kontierung ${coIdent} ist in SAP CO nicht bekannt.`,
    };
  }
  if (knownType !== type) {
    return {
      coIdent,
      type,
      valid: false,
      source: "SAP-CO-Stub",
      message: `Kontierung ${coIdent} ist in SAP CO als ${knownType} gefuehrt, nicht als ${type}.`,
    };
  }
  return {
    coIdent,
    type,
    valid: true,
    source: "SAP-CO-Stub",
    message: `Kontierung ${coIdent} (${type}) ist in SAP CO gueltig.`,
  };
}

// --- Mitarbeiter-Kontierung (Planungsbasis) --------------------------------

export function upsertAssignment(payload, changedBy) {
  const extNr = trimmed(payload.extNr).toUpperCase();
  const coIdent = trimmed(payload.coIdent);
  if (!extNr || !coIdent) {
    return {
      error: {
        status: 400,
        code: "INVALID_ASSIGNMENT",
        fields: [!extNr && "EXTNR", !coIdent && "KONTIERUNG"].filter(Boolean),
      },
    };
  }
  const validityError = validateValidity(payload, "INVALID_ASSIGNMENT");
  if (validityError) return { error: validityError };
  const employee = findEmployee(extNr);
  if (!employee) {
    return { error: { status: 404, code: "UNKNOWN_EMPLOYEE" } };
  }
  const costObject = findCostObject(coIdent);
  if (!costObject) {
    return { error: { status: 409, code: "COST_OBJECT_NOT_AVAILABLE" } };
  }
  const existing = payload.id
    ? store.assignments.find((item) => item.id === payload.id)
    : null;
  if (payload.id && !existing) {
    return { error: { status: 404, code: "ASSIGNMENT_NOT_FOUND" } };
  }
  const deleted = payload.deleted === true;
  const candidate = { validFrom: payload.validFrom, validTo: payload.validTo };
  const conflict =
    !deleted &&
    listAssignments().find(
      (item) =>
        item !== existing &&
        item.extNr === extNr &&
        item.coIdent === coIdent &&
        overlaps(item, candidate),
    );
  if (conflict) {
    return {
      error: {
        status: 409,
        code: "ASSIGNMENT_OVERLAP",
        conflictId: conflict.id,
      },
    };
  }
  let assignment = existing;
  if (!assignment) {
    store.counters.assignment += 1;
    assignment = { id: String(store.counters.assignment).padStart(6, "0") };
    store.assignments.push(assignment);
  }
  Object.assign(assignment, {
    extNr,
    coIdent,
    description: `${costObject.description.split(",")[0]}, ${employee.displayName}`,
    validFrom: payload.validFrom,
    validTo: payload.validTo,
    deleted,
  });
  stamp(assignment, changedBy);
  return { assignment: { ...assignment } };
}
