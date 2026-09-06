import { Injectable, inject } from "@angular/core";

import { D } from "../shared/decode";
import { ODataClient } from "../shared/odata";
import { planningOverview, saveEntryResult } from "./planning.decoders";
import type {
  PlanningFilters,
  PlanningOverview,
  SaveEntryResult,
} from "./planning.models";

@Injectable({
  providedIn: "root",
})
export class PlanningService {
  private readonly odata = inject(ODataClient);

  getOverview(
    start: string,
    filters: PlanningFilters,
  ): Promise<PlanningOverview> {
    return this.odata.get("PlanningOverview", planningOverview, {
      start,
      extNr: filters.extNr,
      team: filters.team,
      coIdent: filters.coIdent,
    });
  }

  saveEntry(
    extNr: string,
    coIdent: string,
    month: string,
    hours: number,
  ): Promise<SaveEntryResult> {
    return this.odata.post(
      "PlanningEntries",
      { extNr, coIdent, month, hours },
      saveEntryResult,
    );
  }

  async releaseEntry(
    extNr: string,
    coIdent: string,
    month: string,
  ): Promise<void> {
    await this.odata.post(
      "PlanningReleases",
      { extNr, coIdent, month },
      D.unknown,
    );
  }
}
