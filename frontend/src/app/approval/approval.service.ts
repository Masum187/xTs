import { Injectable, inject } from "@angular/core";

import { costObjectApprover } from "../admin/admin.decoders";
import type { CostObjectApprover } from "../admin/admin.models";
import { ODataClient } from "../shared/odata";
import { approvalDay, timesheetDay } from "../timesheet/timesheet.decoders";
import type { ApprovalDay, TimesheetDay } from "../timesheet/timesheet.models";

@Injectable({
  providedIn: "root",
})
export class ApprovalService {
  private readonly odata = inject(ODataClient);

  getApprovalTimesheets(): Promise<ApprovalDay[]> {
    return this.odata.list("ApprovalTimesheets", approvalDay);
  }

  /** Eigene Genehmigerzuordnungen (admin: alle), fuer den Hinweis ohne Zuordnung. */
  getMyResponsibilities(): Promise<CostObjectApprover[]> {
    return this.odata.list("CostObjectApprovers", costObjectApprover);
  }

  approveDay(extNr: string, date: string): Promise<TimesheetDay> {
    return this.sendApproval({ extNr, date, action: "approve" });
  }

  rejectDay(
    extNr: string,
    date: string,
    reason: string,
  ): Promise<TimesheetDay> {
    return this.sendApproval({ extNr, date, action: "reject", reason });
  }

  private sendApproval(payload: {
    extNr: string;
    date: string;
    action: "approve" | "reject";
    reason?: string;
  }): Promise<TimesheetDay> {
    return this.odata.post("TimesheetApprovals", payload, timesheetDay);
  }
}
