import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import { readApiJson } from "../shared/api-error";
import type {
  PlanningFilters,
  PlanningOverview,
  SaveEntryResult,
} from "./planning.models";

@Injectable({
  providedIn: "root",
})
export class PlanningService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getOverview(
    start: string,
    filters: PlanningFilters,
  ): Promise<PlanningOverview> {
    const params = new URLSearchParams({ start });
    if (filters.extNr) params.set("extNr", filters.extNr);
    if (filters.team) params.set("team", filters.team);
    if (filters.coIdent) params.set("coIdent", filters.coIdent);
    const response = await fetch(
      `${this.baseUrl}/PlanningOverview?${params.toString()}`,
      { headers: this.auth.authHeaders() },
    );
    return this.readJson<PlanningOverview>(response);
  }

  async saveEntry(
    extNr: string,
    coIdent: string,
    month: string,
    hours: number,
  ): Promise<SaveEntryResult> {
    return this.post<SaveEntryResult>(`${this.baseUrl}/PlanningEntries`, {
      extNr,
      coIdent,
      month,
      hours,
    });
  }

  async releaseEntry(
    extNr: string,
    coIdent: string,
    month: string,
  ): Promise<void> {
    await this.post(`${this.baseUrl}/PlanningReleases`, {
      extNr,
      coIdent,
      month,
    });
  }

  private async post<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
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
