import { D, type Decoder, type Shape } from "../shared/decode";
import type {
  AuditEntry,
  ChangeStamp,
  CostObject,
  CostObjectAssignment,
  CostObjectCheck,
  Employee,
  Rule,
  Team,
  TeamAssignment,
  TestDataReset,
} from "./admin.models";
import { COST_OBJECT_TYPES } from "./admin.models";

const changeStamp: Shape<ChangeStamp> = {
  changedBy: D.optional(D.string),
  changedAt: D.optional(D.dateTime),
};

export const rule: Decoder<Rule> = D.object<Rule>({
  infotype: D.literal(1, 2, 3),
  value: D.string,
  active: D.boolean,
});

// Nicht-Admins erhalten die reduzierte Form ohne Zugangs- und Personaldetails
// (Entscheidung 16); fehlende Felder werden neutral belegt.
export const employee: Decoder<Employee> = D.object<Employee>({
  ...changeStamp,
  extNr: D.string,
  firstName: D.string,
  lastName: D.string,
  displayName: D.string,
  company: D.text,
  sapAccount: D.fallback(D.nullable(D.string), null),
  aadOid: D.fallback(D.nullable(D.string), null),
  aadUpn: D.fallback(D.nullable(D.string), null),
  active: D.boolean,
  deleted: D.fallback(D.boolean, false),
  resourceManager: D.fallback(D.nullable(D.string), null),
  roles: D.fallback(D.array(D.string), []),
});

export const team: Decoder<Team> = D.object<Team>({
  ...changeStamp,
  id: D.string,
  name: D.string,
  active: D.boolean,
  deleted: D.fallback(D.boolean, false),
});

export const teamAssignment: Decoder<TeamAssignment> = D.object<TeamAssignment>(
  {
    ...changeStamp,
    id: D.string,
    extNr: D.string,
    displayName: D.optional(D.string),
    teamId: D.string,
    validFrom: D.date,
    validTo: D.date,
    deleted: D.fallback(D.boolean, false),
  },
);

export const costObject: Decoder<CostObject> = D.object<CostObject>({
  ...changeStamp,
  id: D.string,
  coIdent: D.string,
  type: D.literal(...COST_OBJECT_TYPES),
  description: D.text,
  active: D.boolean,
  deleted: D.fallback(D.boolean, false),
});

export const costObjectCheck: Decoder<CostObjectCheck> =
  D.object<CostObjectCheck>({
    coIdent: D.string,
    type: D.string,
    valid: D.boolean,
    source: D.string,
    message: D.text,
  });

export const costObjectAssignment: Decoder<CostObjectAssignment> =
  D.object<CostObjectAssignment>({
    ...changeStamp,
    id: D.string,
    extNr: D.string,
    displayName: D.optional(D.string),
    coIdent: D.string,
    description: D.text,
    validFrom: D.date,
    validTo: D.date,
    deleted: D.fallback(D.boolean, false),
  });

export const auditEntry: Decoder<AuditEntry> = D.object<AuditEntry>({
  id: D.string,
  at: D.dateTime,
  actor: D.text,
  category: D.literal("status", "job", "masterdata", "rule", "system"),
  severity: D.literal("info", "error"),
  object: D.text,
  objectKey: D.text,
  from: D.nullable(D.string),
  to: D.nullable(D.string),
  message: D.text,
  details: D.fallback(D.record(D.unknown), {}),
});

export const testDataReset: Decoder<TestDataReset> = D.object<TestDataReset>({
  package: D.string,
  resetBy: D.string,
  resetAt: D.dateTime,
  counts: D.record(D.integer),
});
