import { Injectable, inject } from "@angular/core";

import { ODataClient } from "../shared/odata";
import {
  auditEntry,
  costObject,
  costObjectAssignment,
  costObjectCheck,
  employee,
  rule,
  team,
  teamAssignment,
  testDataReset,
} from "./admin.decoders";
import type {
  AuditEntry,
  AuditFilters,
  CostObject,
  CostObjectAssignment,
  CostObjectCheck,
  Employee,
  Rule,
  Team,
  TeamAssignment,
  TestDataReset,
} from "./admin.models";

@Injectable({
  providedIn: "root",
})
export class AdminService {
  private readonly odata = inject(ODataClient);

  getRules(): Promise<Rule[]> {
    return this.odata.list("Rules", rule);
  }

  saveRule(payload: Rule): Promise<Rule> {
    return this.odata.post("Rules", payload, rule);
  }

  getEmployees(): Promise<Employee[]> {
    return this.odata.list("Employees", employee, { includeDeleted: "true" });
  }

  saveEmployee(payload: Partial<Employee>): Promise<Employee> {
    return this.odata.post("Employees", payload, employee);
  }

  getTeams(): Promise<Team[]> {
    return this.odata.list("Teams", team, { includeInactive: "true" });
  }

  saveTeam(payload: Partial<Team>): Promise<Team> {
    return this.odata.post("Teams", payload, team);
  }

  getTeamAssignments(): Promise<TeamAssignment[]> {
    return this.odata.list("TeamAssignments", teamAssignment);
  }

  saveTeamAssignment(
    payload: Partial<TeamAssignment>,
  ): Promise<TeamAssignment> {
    return this.odata.post("TeamAssignments", payload, teamAssignment);
  }

  getCostObjects(): Promise<CostObject[]> {
    return this.odata.list("CostObjects", costObject, {
      includeDeleted: "true",
    });
  }

  saveCostObject(payload: Partial<CostObject>): Promise<CostObject> {
    return this.odata.post("CostObjects", payload, costObject);
  }

  checkCostObject(payload: {
    coIdent: string;
    type: string;
  }): Promise<CostObjectCheck> {
    return this.odata.post("CostObjectChecks", payload, costObjectCheck);
  }

  getCostObjectAssignments(): Promise<CostObjectAssignment[]> {
    return this.odata.list("CostObjectAssignments", costObjectAssignment);
  }

  saveCostObjectAssignment(
    payload: Partial<CostObjectAssignment>,
  ): Promise<CostObjectAssignment> {
    return this.odata.post(
      "CostObjectAssignments",
      payload,
      costObjectAssignment,
    );
  }

  getAuditLog(filters: AuditFilters): Promise<AuditEntry[]> {
    return this.odata.list("AuditLog", auditEntry, {
      category: filters.category,
      severity: filters.severity,
      q: filters.q,
    });
  }

  resetTestData(): Promise<TestDataReset> {
    return this.odata.post("TestDataResets", {}, testDataReset);
  }
}
