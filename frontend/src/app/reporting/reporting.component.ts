import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";

import type {
  BudgetDetailLevel,
  BudgetRow,
  LifecycleRow,
  OrderStatus,
  QuotaRow,
  Team,
  TrafficLight,
} from "./reporting.models";
import { ReportingService } from "./reporting.service";

const TRAFFIC_LABELS: Record<TrafficLight, string> = {
  green: "im Plan",
  yellow: "Warnung",
  red: "kritisch",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "angelegt",
  banf: "BANF",
  bestellt: "bestellt",
};

@Component({
  selector: "xts-reporting",
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LoadStatusComponent],
  templateUrl: "./reporting.component.html",
  styleUrl: "./reporting.component.css",
})
export class ReportingComponent {
  private readonly reportingService = inject(ReportingService);

  protected readonly lifecycleLoader = new LoadState();
  protected readonly budgetLoader = new LoadState();
  protected readonly quotaLoader = new LoadState();
  protected readonly lifecycleRows = signal<LifecycleRow[]>([]);
  protected readonly lifecycleFrom = signal<string>("");
  protected readonly lifecycleTo = signal<string>("");
  protected readonly lifecycleEbeln = signal<string>("");
  protected readonly lifecycleEbelp = signal<string>("");

  protected readonly budgetRows = signal<BudgetRow[]>([]);
  protected readonly budgetDetail = signal<BudgetDetailLevel>("none");

  protected readonly quotaRows = signal<QuotaRow[]>([]);
  protected readonly quotaLastName = signal<string>("");
  protected readonly quotaTeam = signal<string>("");
  protected readonly quotaFrom = signal<string>("");
  protected readonly quotaTo = signal<string>("");
  protected readonly quotaDayDetail = signal<boolean>(false);

  protected readonly teams = signal<Team[]>([]);

  constructor() {
    void this.reportingService.getTeams().then((teams) => {
      this.teams.set(teams);
    });
    void this.loadLifecycle();
    void this.loadBudget();
    void this.loadQuota();
  }

  protected trafficLabel(light: TrafficLight): string {
    return TRAFFIC_LABELS[light];
  }

  protected orderStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status];
  }

  protected hasAny(row: LifecycleRow, field: "banfNumber" | "ebeln"): boolean {
    return row.orders.some((order) => order[field] !== null);
  }

  protected async updateLifecycleFilter(
    patch: Partial<{
      from: string;
      to: string;
      ebeln: string;
      ebelp: string;
    }>,
  ): Promise<void> {
    if (patch.from !== undefined) this.lifecycleFrom.set(patch.from);
    if (patch.to !== undefined) this.lifecycleTo.set(patch.to);
    if (patch.ebeln !== undefined) this.lifecycleEbeln.set(patch.ebeln);
    if (patch.ebelp !== undefined) this.lifecycleEbelp.set(patch.ebelp);
    await this.loadLifecycle();
  }

  protected async setBudgetDetail(detail: BudgetDetailLevel): Promise<void> {
    this.budgetDetail.set(detail);
    await this.loadBudget();
  }

  protected async updateQuotaFilter(
    patch: Partial<{
      lastName: string;
      team: string;
      from: string;
      to: string;
      dayDetail: boolean;
    }>,
  ): Promise<void> {
    if (patch.lastName !== undefined) this.quotaLastName.set(patch.lastName);
    if (patch.team !== undefined) this.quotaTeam.set(patch.team);
    if (patch.from !== undefined) this.quotaFrom.set(patch.from);
    if (patch.to !== undefined) this.quotaTo.set(patch.to);
    if (patch.dayDetail !== undefined) this.quotaDayDetail.set(patch.dayDetail);
    await this.loadQuota();
  }

  protected reloadLifecycle(): void {
    void this.loadLifecycle();
  }

  protected reloadBudget(): void {
    void this.loadBudget();
  }

  protected reloadQuota(): void {
    void this.loadQuota();
  }

  private async loadLifecycle(): Promise<void> {
    await this.lifecycleLoader.track(async () => {
      this.lifecycleRows.set(
        await this.reportingService.getResourceLifecycle({
          from: this.lifecycleFrom(),
          to: this.lifecycleTo(),
          ebeln: this.lifecycleEbeln().trim(),
          ebelp: this.lifecycleEbelp().trim(),
        }),
      );
    }, "Ressourcen-Live-Circle konnte nicht geladen werden.");
  }

  private async loadBudget(): Promise<void> {
    await this.budgetLoader.track(async () => {
      this.budgetRows.set(
        await this.reportingService.getBudgetMonitor(this.budgetDetail()),
      );
    }, "Budget-Monitor konnte nicht geladen werden.");
  }

  private async loadQuota(): Promise<void> {
    await this.quotaLoader.track(async () => {
      this.quotaRows.set(
        await this.reportingService.getCostObjectQuota({
          lastName: this.quotaLastName(),
          team: this.quotaTeam(),
          from: this.quotaFrom(),
          to: this.quotaTo(),
          detail: this.quotaDayDetail() ? "day" : "none",
        }),
      );
    }, "Stundenkontingent-Monitor konnte nicht geladen werden.");
  }
}
