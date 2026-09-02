export interface Rule {
  infotype: 1 | 2;
  value: string;
  active: boolean;
}

export interface ChangeStamp {
  changedBy?: string;
  changedAt?: string;
}

export interface Employee extends ChangeStamp {
  extNr: string;
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  sapAccount: string | null;
  aadOid: string | null;
  aadUpn: string | null;
  active: boolean;
  deleted: boolean;
  resourceManager: string | null;
  roles: string[];
}

export interface Team extends ChangeStamp {
  id: string;
  name: string;
  active: boolean;
  deleted: boolean;
}

export interface TeamAssignment extends ChangeStamp {
  id: string;
  extNr: string;
  displayName?: string;
  teamId: string;
  validFrom: string;
  validTo: string;
  deleted: boolean;
}

export const COST_OBJECT_TYPES = ["KS", "OR", "PR", "FB", "KL"] as const;
export type CostObjectType = (typeof COST_OBJECT_TYPES)[number];

export interface CostObject extends ChangeStamp {
  id: string;
  coIdent: string;
  type: CostObjectType;
  description: string;
  active: boolean;
  deleted: boolean;
}

export interface CostObjectCheck {
  coIdent: string;
  type: string;
  valid: boolean;
  source: string;
  message: string;
}

export interface CostObjectAssignment extends ChangeStamp {
  id: string;
  extNr: string;
  displayName?: string;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  deleted: boolean;
}

export type AuditCategory = "status" | "job" | "masterdata" | "rule" | "system";
export type AuditSeverity = "info" | "error";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  category: AuditCategory;
  severity: AuditSeverity;
  object: string;
  objectKey: string;
  from: string | null;
  to: string | null;
  message: string;
  details: Record<string, unknown>;
}

export interface AuditFilters {
  category: string;
  severity: string;
  q: string;
}

export interface TestDataReset {
  package: string;
  resetBy: string;
  resetAt: string;
  counts: Record<string, number>;
}

export type EmployeeDraft = Pick<
  Employee,
  | "extNr"
  | "firstName"
  | "lastName"
  | "company"
  | "sapAccount"
  | "aadOid"
  | "aadUpn"
  | "active"
  | "resourceManager"
>;
export type TeamDraft = Pick<Team, "id" | "name" | "active">;
export type TeamAssignmentDraft = Pick<
  TeamAssignment,
  "extNr" | "teamId" | "validFrom" | "validTo"
>;
export type CostObjectDraft = Pick<
  CostObject,
  "coIdent" | "type" | "description" | "active"
>;
export type CostObjectAssignmentDraft = Pick<
  CostObjectAssignment,
  "extNr" | "coIdent" | "validFrom" | "validTo"
>;
