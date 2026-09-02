import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import { readApiJson } from "../shared/api-error";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class TimesheetService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getEnabledCostObjects(date?: string): Promise<EnabledCostObject[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await fetch(
      `${this.baseUrl}/MyEnabledCostObjects${query}`,
      { headers: this.auth.authHeaders() },
    );
    const body =
      await this.readJson<ODataResponse<EnabledCostObject>>(response);
    return body.value;
  }

  async getMyTimesheets(): Promise<TimesheetDay[]> {
    const response = await fetch(`${this.baseUrl}/MyTimesheets`, {
      headers: this.auth.authHeaders(),
    });
    const body = await this.readJson<ODataResponse<TimesheetDay>>(response);
    return body.value;
  }

  async saveTimesheet(day: TimesheetDay): Promise<TimesheetDay> {
    const response = await fetch(`${this.baseUrl}/TimesheetDays`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.auth.authHeaders(),
      },
      body: JSON.stringify(day),
    });
    return this.readJson<TimesheetDay>(response);
  }

  private readJson<T>(response: Response): Promise<T> {
    return readApiJson<T>(response);
  }
}
