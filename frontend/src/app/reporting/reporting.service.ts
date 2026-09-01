import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import type {
  BudgetDetailLevel,
  BudgetRow,
  QuotaFilters,
  QuotaRow,
  Team,
} from "./reporting.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class ReportingService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getBudgetMonitor(detail: BudgetDetailLevel): Promise<BudgetRow[]> {
    const query = detail === "none" ? "" : `?detail=${detail}`;
    return this.readValues<BudgetRow>(`${this.baseUrl}/BudgetMonitor${query}`);
  }

  async getCostObjectQuota(filters: QuotaFilters): Promise<QuotaRow[]> {
    const params = new URLSearchParams();
    if (filters.lastName) params.set("lastName", filters.lastName);
    if (filters.team) params.set("team", filters.team);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.detail !== "none") params.set("detail", filters.detail);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.readValues<QuotaRow>(`${this.baseUrl}/CostObjectQuota${query}`);
  }

  async getTeams(): Promise<Team[]> {
    return this.readValues<Team>(`${this.baseUrl}/Teams`);
  }

  private async readValues<T>(url: string): Promise<T[]> {
    const response = await fetch(url, { headers: this.auth.authHeaders() });
    if (!response.ok) {
      throw new Error(`Request failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as ODataResponse<T>;
    return body.value;
  }
}
