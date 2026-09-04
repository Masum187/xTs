import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";

import {
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  isCostObjectBookable,
  quotaProblems,
  shiftDate,
  sumLineHours,
  validateTimesheetDay,
} from "./timesheet.logic";
import { AuthService } from "../auth/auth.service";
import type {
  EnabledCostObject,
  TimesheetDay,
  TimesheetStatus,
} from "./timesheet.models";
import { TimesheetService } from "./timesheet.service";

const STATUS_LABELS: Record<TimesheetStatus, string> = {
  E: "Entwurf",
  F: "Zur Genehmigung freigegeben",
  G: "Genehmigt",
  A: "Zurückgewiesen",
};

@Component({
  selector: "xts-timesheet",
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: "./timesheet.component.html",
  styleUrl: "./timesheet.component.css",
})
export class TimesheetComponent {
  private readonly timesheetService = inject(TimesheetService);
  private readonly auth = inject(AuthService);
  private readonly savedDays = new Map<string, TimesheetDay>();

  protected readonly profile = this.auth.profile;
  protected readonly costObjects = signal<EnabledCostObject[]>([]);
  protected readonly selectedCostObject = signal<string>("");
  protected readonly message = signal<string>("");
  protected readonly day = signal<TimesheetDay>(createEmptyDay("", ""));

  protected readonly totalHours = computed(() =>
    sumLineHours(this.day().lines),
  );
  protected readonly canEdit = computed(() => canEditTimesheet(this.day()));
  /** Kontingentprobleme gegen die zuletzt geladenen Freischaltungen. */
  protected readonly quotaIssues = computed(() =>
    quotaProblems(
      this.day(),
      this.savedDays.get(this.day().date),
      this.costObjects(),
    ),
  );
  protected readonly canSubmit = computed(
    () => canSubmitTimesheet(this.day()) && this.quotaIssues().length === 0,
  );
  /** Fachliche Probleme des Tages: Entwurfsregeln immer, Freigaberegeln sobald Positionen da sind. */
  protected readonly problems = computed(() => [
    ...validateTimesheetDay(
      this.day(),
      this.day().lines.length > 0 ? "submit" : "draft",
    ),
    ...this.quotaIssues(),
  ]);
  protected readonly statusLabel = computed(
    () => STATUS_LABELS[this.day().status],
  );
  protected readonly bookableCostObjects = computed(() =>
    this.costObjects().filter((item) =>
      isCostObjectBookable(item, this.day().date),
    ),
  );

  constructor() {
    void this.loadInitialData();
  }

  protected isBookable(costObject: EnabledCostObject): boolean {
    return isCostObjectBookable(costObject, this.day().date);
  }

  protected openDate(date: string): void {
    if (!date) return;
    this.message.set("");
    const saved = this.savedDays.get(date);
    this.day.set(saved ?? createEmptyDay(this.currentExtNr(), date));
    this.ensureSelectableCostObject();
  }

  protected previousDay(): void {
    this.openDate(shiftDate(this.day().date, -1));
  }

  protected nextDay(): void {
    this.openDate(shiftDate(this.day().date, 1));
  }

  protected addLine(): void {
    const selected = this.bookableCostObjects().find(
      (item) => item.coIdent === this.selectedCostObject(),
    );
    if (!selected || !this.canEdit()) return;

    this.day.update((day) => ({
      ...day,
      lines: [
        ...day.lines,
        {
          coIdent: selected.coIdent,
          description: "",
          hours: 0,
        },
      ],
    }));
  }

  protected removeLine(index: number): void {
    if (!this.canEdit()) return;
    this.day.update((day) => ({
      ...day,
      lines: day.lines.filter((_line, currentIndex) => currentIndex !== index),
    }));
  }

  protected updateDay(patch: Partial<TimesheetDay>): void {
    this.day.update((day) => ({ ...day, ...patch }));
  }

  protected updateLine(
    index: number,
    patch: Partial<TimesheetDay["lines"][number]>,
  ): void {
    this.day.update((day) => ({
      ...day,
      lines: day.lines.map((line, currentIndex) =>
        currentIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  protected async save(): Promise<void> {
    const problems = [
      ...validateTimesheetDay(this.day(), "draft"),
      ...this.quotaIssues(),
    ];
    if (problems.length > 0) {
      this.message.set(problems[0].message);
      return;
    }
    try {
      const draft: TimesheetDay = {
        ...this.day(),
        status: "E",
        rejectionReason: undefined,
      };
      const saved = await this.persist(draft);
      this.message.set(
        this.day().status === "A"
          ? "Korrektur als Entwurf gespeichert."
          : "Entwurf gespeichert.",
      );
      this.day.set(saved);
    } catch (error) {
      this.message.set(this.saveErrorMessage(error));
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    try {
      const saved = await this.persist({
        ...this.day(),
        status: "F",
        rejectionReason: undefined,
      });
      this.day.set(saved);
      this.message.set("Zur Genehmigung freigegeben.");
    } catch (error) {
      this.message.set(this.saveErrorMessage(error));
    }
  }

  private async persist(day: TimesheetDay): Promise<TimesheetDay> {
    const saved = await this.timesheetService.saveTimesheet(day);
    this.savedDays.set(saved.date, saved);
    // Reststunden neu laden, sonst zeigt das Kontingent-Panel alte Werte
    // (Audit Nr. 21) und die Kontingentpruefung rechnet mit ihnen.
    this.costObjects.set(await this.timesheetService.getEnabledCostObjects());
    return saved;
  }

  private currentExtNr(): string {
    return this.profile()?.extNr ?? this.day().extNr;
  }

  private ensureSelectableCostObject(): void {
    const bookable = this.bookableCostObjects();
    const stillValid = bookable.some(
      (item) => item.coIdent === this.selectedCostObject(),
    );
    if (!stillValid) {
      this.selectedCostObject.set(bookable[0]?.coIdent ?? "");
    }
  }

  private saveErrorMessage(error: unknown): string {
    return describeApiError(
      error,
      "Stundenzettel konnte nicht gespeichert werden.",
    );
  }

  private async loadInitialData(): Promise<void> {
    const [costObjects, timesheets] = await Promise.all([
      this.timesheetService.getEnabledCostObjects(),
      this.timesheetService.getMyTimesheets(),
    ]);
    this.costObjects.set(costObjects);
    for (const day of timesheets) {
      this.savedDays.set(day.date, day);
    }
    const latestDate =
      timesheets[0]?.date ?? new Date().toISOString().slice(0, 10);
    this.openDate(latestDate);
    const extNr = this.currentExtNr();
    this.day.update((day) => ({ ...day, extNr }));
  }
}
