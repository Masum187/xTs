import { Injectable, inject } from "@angular/core";

import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import type { ApprovalDay, TimesheetDay } from "../timesheet/timesheet.models";

interface ODataResponse<T> {
  value: T[];
}

@Injectable({
  providedIn: "root",
})
export class ApprovalService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly auth = inject(AuthService);

  async getApprovalTimesheets(): Promise<ApprovalDay[]> {
    const response = await fetch(`${this.baseUrl}/ApprovalTimesheets`, {
      headers: this.auth.authHeaders(),
    });
    const body = await this.readJson<ODataResponse<ApprovalDay>>(response);
    return body.value;
  }

  async approveDay(extNr: string, date: string): Promise<TimesheetDay> {
    return this.sendApproval({ extNr, date, action: "approve" });
  }

  async rejectDay(
    extNr: string,
    date: string,
    reason: string,
  ): Promise<TimesheetDay> {
    return this.sendApproval({ extNr, date, action: "reject", reason });
  }

  private async sendApproval(payload: {
    extNr: string;
    date: string;
    action: "approve" | "reject";
    reason?: string;
  }): Promise<TimesheetDay> {
    const response = await fetch(`${this.baseUrl}/TimesheetApprovals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.auth.authHeaders(),
      },
      body: JSON.stringify(payload),
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
