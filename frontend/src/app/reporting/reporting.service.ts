import { Injectable, inject } from "@angular/core";

import { ODataClient } from "../shared/odata";
import { budgetRow, lifecycleRow, quotaRow, team } from "./reporting.decoders";
import type {
  BudgetDetailLevel,
  BudgetRow,
  LifecycleFilters,
  LifecycleRow,
  QuotaFilters,
  QuotaRow,
  Team,
} from "./reporting.models";

@Injectable({
  providedIn: "root",
})
export class ReportingService {
  private readonly odata = inject(ODataClient);

  getBudgetMonitor(detail: BudgetDetailLevel): Promise<BudgetRow[]> {
    return this.odata.list("BudgetMonitor", budgetRow, {
      detail: detail === "none" ? "" : detail,
    });
  }

  getCostObjectQuota(filters: QuotaFilters): Promise<QuotaRow[]> {
    return this.odata.list("CostObjectQuota", quotaRow, {
      lastName: filters.lastName,
      team: filters.team,
      from: filters.from,
      to: filters.to,
      detail: filters.detail === "none" ? "" : filters.detail,
    });
  }

  getResourceLifecycle(filters: LifecycleFilters): Promise<LifecycleRow[]> {
    return this.odata.list("ResourceLifecycle", lifecycleRow, {
      from: filters.from,
      to: filters.to,
      ebeln: filters.ebeln,
      ebelp: filters.ebelp,
    });
  }

  getTeams(): Promise<Team[]> {
    return this.odata.list("Teams", team);
  }
}
