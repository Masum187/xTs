import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import { readApiJson } from "../shared/api-error";
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

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class AdminService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  getRules(): Promise<Rule[]> {
    return this.list<Rule>("Rules");
  }

  saveRule(rule: Rule): Promise<Rule> {
    return this.post<Rule>("Rules", rule);
  }

  getEmployees(): Promise<Employee[]> {
    return this.list<Employee>("Employees", "includeDeleted=true");
  }

  saveEmployee(employee: Partial<Employee>): Promise<Employee> {
    return this.post<Employee>("Employees", employee);
  }

  getTeams(): Promise<Team[]> {
    return this.list<Team>("Teams", "includeInactive=true");
  }

  saveTeam(team: Partial<Team>): Promise<Team> {
    return this.post<Team>("Teams", team);
  }

  getTeamAssignments(): Promise<TeamAssignment[]> {
    return this.list<TeamAssignment>("TeamAssignments");
  }

  saveTeamAssignment(
    assignment: Partial<TeamAssignment>,
  ): Promise<TeamAssignment> {
    return this.post<TeamAssignment>("TeamAssignments", assignment);
  }

  getCostObjects(): Promise<CostObject[]> {
    return this.list<CostObject>("CostObjects", "includeDeleted=true");
  }

  saveCostObject(costObject: Partial<CostObject>): Promise<CostObject> {
    return this.post<CostObject>("CostObjects", costObject);
  }

  checkCostObject(costObject: {
    coIdent: string;
    type: string;
  }): Promise<CostObjectCheck> {
    return this.post<CostObjectCheck>("CostObjectChecks", costObject);
  }

  getCostObjectAssignments(): Promise<CostObjectAssignment[]> {
    return this.list<CostObjectAssignment>("CostObjectAssignments");
  }

  saveCostObjectAssignment(
    assignment: Partial<CostObjectAssignment>,
  ): Promise<CostObjectAssignment> {
    return this.post<CostObjectAssignment>("CostObjectAssignments", assignment);
  }

  getAuditLog(filters: AuditFilters): Promise<AuditEntry[]> {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.q) params.set("q", filters.q);
    return this.list<AuditEntry>("AuditLog", params.toString());
  }

  resetTestData(): Promise<TestDataReset> {
    return this.post<TestDataReset>("TestDataResets", {});
  }

  private async list<T>(path: string, query = ""): Promise<T[]> {
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${this.baseUrl}/${path}${suffix}`, {
      headers: this.auth.authHeaders(),
    });
    const body = await this.readJson<ODataResponse<T>>(response);
    return body.value;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.auth.authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    return this.readJson<T>(response);
  }

  private readJson<T>(response: Response): Promise<T> {
    return readApiJson<T>(response);
  }
}
