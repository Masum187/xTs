import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import type {
  BudgetDetailLevel,
  BudgetRow,
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

@Component({
  selector: "xts-reporting",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./reporting.component.html",
  styleUrl: "./reporting.component.css",
})
export class ReportingComponent {
  private readonly reportingService = inject(ReportingService);

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
    void this.loadBudget();
    void this.loadQuota();
  }

  protected trafficLabel(light: TrafficLight): string {
    return TRAFFIC_LABELS[light];
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

  private async loadBudget(): Promise<void> {
    this.budgetRows.set(
      await this.reportingService.getBudgetMonitor(this.budgetDetail()),
    );
  }

  private async loadQuota(): Promise<void> {
    this.quotaRows.set(
      await this.reportingService.getCostObjectQuota({
        lastName: this.quotaLastName(),
        team: this.quotaTeam(),
        from: this.quotaFrom(),
        to: this.quotaTo(),
        detail: this.quotaDayDetail() ? "day" : "none",
      }),
    );
  }
}
