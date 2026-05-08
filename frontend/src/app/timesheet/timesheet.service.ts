import { Injectable } from "@angular/core";

import { environment } from "../../environments/environment";
import { EmployeeProfile, EnabledCostObject, TimesheetDay } from "./timesheet.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root"
})
export class TimesheetService {
  private readonly baseUrl = environment.apiBaseUrl;

  async getProfile(): Promise<EmployeeProfile> {
    const response = await fetch(`${this.baseUrl}/MyProfile`);
    return this.readJson<EmployeeProfile>(response);
  }

  async getEnabledCostObjects(date: string): Promise<EnabledCostObject[]> {
    const response = await fetch(`${this.baseUrl}/MyEnabledCostObjects?date=${encodeURIComponent(date)}`);
    const body = await this.readJson<ODataResponse<EnabledCostObject>>(response);
    return body.value;
  }

  async saveTimesheet(day: TimesheetDay): Promise<TimesheetDay> {
    const response = await fetch(`${this.baseUrl}/TimesheetDays`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(day)
    });
    return this.readJson<TimesheetDay>(response);
  }

  private async readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`Request failed with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

