import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";

import type { Team } from "../reporting/reporting.models";
import { ReportingService } from "../reporting/reporting.service";
import { formatMonthLabel, parseStartMonth } from "./planning.logic";
import type {
  PlanningCell,
  PlanningOverview,
  PlanningRow,
} from "./planning.models";
import { PlanningService } from "./planning.service";

interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: "xts-planning",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./planning.component.html",
  styleUrl: "./planning.component.css",
})
export class PlanningComponent {
  private readonly planningService = inject(PlanningService);
  private readonly reportingService = inject(ReportingService);

  protected readonly startInput = signal<string>("03.2026");
  protected readonly startError = signal<boolean>(false);
  protected readonly filterExtNr = signal<string>("");
  protected readonly filterTeam = signal<string>("");
  protected readonly filterCoIdent = signal<string>("");
  protected readonly overview = signal<PlanningOverview | null>(null);
  protected readonly message = signal<string>("");
  protected readonly warning = signal<string>("");

  protected readonly teams = signal<Team[]>([]);
  protected readonly employeeOptions = signal<FilterOption[]>([]);
  protected readonly coIdentOptions = signal<FilterOption[]>([]);

  protected readonly monthLabels = computed(() =>
    (this.overview()?.months ?? []).map((entry) => ({
      ...entry,
      label: formatMonthLabel(entry.month),
    })),
  );

  constructor() {
    void this.reportingService.getTeams().then((teams) => {
      this.teams.set(teams);
    });
    void this.load(true);
  }

  protected formatMonth(month: string): string {
    return formatMonthLabel(month);
  }

  protected async onStartChange(value: string): Promise<void> {
    this.startInput.set(value);
    await this.load();
  }

  protected async updateFilter(
    patch: Partial<{ extNr: string; team: string; coIdent: string }>,
  ): Promise<void> {
    if (patch.extNr !== undefined) this.filterExtNr.set(patch.extNr);
    if (patch.team !== undefined) this.filterTeam.set(patch.team);
    if (patch.coIdent !== undefined) this.filterCoIdent.set(patch.coIdent);
    await this.load();
  }

  protected async saveCell(
    row: PlanningRow,
    cell: PlanningCell,
    rawValue: string,
  ): Promise<void> {
    const hours = Number(rawValue);
    if (Number.isNaN(hours) || hours < 0) return;
    try {
      const result = await this.planningService.saveEntry(
        row.extNr,
        row.coIdent,
        cell.month,
        hours,
      );
      this.message.set(
        `Planstunden für ${row.displayName}, ${this.formatMonth(cell.month)} gespeichert.`,
      );
      this.warning.set(
        result.overbooked
          ? `Überplanung: ${result.plannedTotal} Std. geplant bei ${result.availableHours} Std. verfügbar (${row.displayName}, ${this.formatMonth(cell.month)}).`
          : "",
      );
    } catch (error) {
      this.message.set(
        describeApiError(
          error,
          "Planstunden konnten nicht gespeichert werden.",
        ),
      );
    }
    await this.load();
  }

  protected async releaseCell(
    row: PlanningRow,
    cell: PlanningCell,
  ): Promise<void> {
    try {
      await this.planningService.releaseEntry(
        row.extNr,
        row.coIdent,
        cell.month,
      );
      this.message.set(
        `Planzeile ${row.displayName}, ${this.formatMonth(cell.month)} für BANF freigegeben.`,
      );
    } catch (error) {
      this.message.set(
        describeApiError(error, "Planzeile konnte nicht freigegeben werden."),
      );
    }
    await this.load();
  }

  private async load(initial = false): Promise<void> {
    const start = parseStartMonth(this.startInput());
    if (!start) {
      this.startError.set(true);
      return;
    }
    this.startError.set(false);
    const overview = await this.planningService.getOverview(start, {
      extNr: this.filterExtNr(),
      team: this.filterTeam(),
      coIdent: this.filterCoIdent(),
    });
    this.overview.set(overview);
    if (initial) {
      const employees = new Map<string, string>();
      const coIdents = new Map<string, string>();
      for (const row of overview.rows) {
        employees.set(row.extNr, row.displayName);
        coIdents.set(row.coIdent, row.description);
      }
      this.employeeOptions.set(
        [...employees.entries()].map(([value, label]) => ({ value, label })),
      );
      this.coIdentOptions.set(
        [...coIdents.entries()].map(([value, label]) => ({
          value,
          label: `${value} – ${label}`,
        })),
      );
    }
  }
}
