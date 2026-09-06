import { Injectable, inject } from "@angular/core";

import { ODataClient } from "../shared/odata";
import { enabledCostObject, timesheetDay } from "./timesheet.decoders";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

@Injectable({
  providedIn: "root",
})
export class TimesheetService {
  private readonly odata = inject(ODataClient);

  getEnabledCostObjects(date?: string): Promise<EnabledCostObject[]> {
    return this.odata.list("MyEnabledCostObjects", enabledCostObject, { date });
  }

  getMyTimesheets(): Promise<TimesheetDay[]> {
    return this.odata.list("MyTimesheets", timesheetDay);
  }

  /**
   * Sendet nur die vom Mitarbeiter gefuehrten Felder (Kontrakt
   * POST /odata/TimesheetDays); Genehmigungsfelder wie `approvedBy` oder
   * `weDocument` fuehrt der Server und lehnt sie im Body ab.
   */
  saveTimesheet(day: TimesheetDay): Promise<TimesheetDay> {
    const payload = {
      extNr: day.extNr,
      date: day.date,
      startTime: day.startTime,
      endTime: day.endTime,
      breakMinutes: day.breakMinutes,
      location: day.location,
      status: day.status,
      varianceReason: day.varianceReason,
      lines: day.lines.map(({ coIdent, description, hours }) => ({
        coIdent,
        description,
        hours,
      })),
    };
    return this.odata.post("TimesheetDays", payload, timesheetDay);
  }
}
