import { DatePipe, DecimalPipe } from "@angular/common";
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import { formatSignedHours } from "../shared/hours";
import { UnsavedChangesService } from "../shared/unsaved-changes.service";

import {
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  dayVariance,
  isCostObjectBookable,
  isSameTimesheet,
  isWeekend,
  isWithinPeriod,
  periodAround,
  quotaProblems,
  shiftDate,
  sumLineHours,
  todayIso,
  validateTimesheetDay,
  workHoursOf,
} from "./timesheet.logic";
import type { DatePeriod } from "./timesheet.logic";
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
  imports: [DatePipe, DecimalPipe, FormsModule, LoadStatusComponent],
  templateUrl: "./timesheet.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./timesheet.component.css",
})
export class TimesheetComponent {
  private readonly timesheetService = inject(TimesheetService);
  private readonly auth = inject(AuthService);
  private readonly unsaved = inject(UnsavedChangesService);
  /** Version des Tages-Caches, damit `isDirty` nach dem Laden neu rechnet. */
  private readonly cacheVersion = signal(0);
  /** Gespeicherte Tage des geladenen Zeitfensters (Audit Nr. 16). */
  private readonly savedDays = new Map<string, TimesheetDay>();
  private loadedPeriod: DatePeriod | null = null;
  protected readonly profile = this.auth.profile;
  /**
   * Zuletzt angefordertes Datum. Startwert ist das Systemdatum des Servers
   * (Entscheidung 18), nicht das Browserdatum; Basis fuer `reload()`:
   * scheitert ein Fensterwechsel, zeigt `day()` noch den alten Tag, der
   * Retry muss aber das angeforderte Fenster laden.
   */
  private requestedDate = this.profile()?.today ?? todayIso();

  protected readonly loader = new LoadState();
  protected readonly busy = new BusyState();
  protected readonly costObjects = signal<EnabledCostObject[]>([]);
  protected readonly selectedCostObject = signal<string>("");
  protected readonly message = signal<string>("");
  protected readonly day = signal<TimesheetDay>(createEmptyDay("", ""));

  protected readonly totalHours = computed(() =>
    sumLineHours(this.day().lines),
  );
  /** Arbeitszeit aus Kommt, Geht und Pause (XTS-052) oder null. */
  protected readonly workHours = computed(() => workHoursOf(this.day()));
  /** Tagesdifferenz Positionssumme minus Arbeitszeit (XTS-053) oder null. */
  protected readonly variance = computed(() => dayVariance(this.day()));
  protected readonly varianceLabel = computed(() => {
    const variance = this.variance();
    return variance === null ? "–" : `${formatSignedHours(variance)} Std.`;
  });
  /** Erfassbarer Zeitraum vom Server (Entscheidung 18) oder null. */
  protected readonly window = computed(
    () => this.profile()?.timesheetWindow ?? null,
  );
  /** Tag liegt ausserhalb des erfassbaren Zeitraums (nur lesen). */
  protected readonly dateLocked = computed(() => {
    const window = this.window();
    return window !== null && !isWithinPeriod(window, this.day().date);
  });
  protected readonly weekend = computed(() => isWeekend(this.day().date));
  /** Ungespeicherte Aenderungen gegenueber dem gespeicherten bzw. leeren Tag (Audit Nr. 19). */
  protected readonly isDirty = computed(() => {
    this.cacheVersion();
    const day = this.day();
    if (!day.date || !this.loader.ready()) return false;
    const baseline =
      this.savedDays.get(day.date) ?? createEmptyDay(day.extNr, day.date);
    return !isSameTimesheet(day, baseline);
  });
  /** Bearbeitbar nur im Status E/A, im Zeitraum und solange keine Anfrage laeuft. */
  protected readonly canEdit = computed(
    () => canEditTimesheet(this.day(), this.window()) && !this.busy.active(),
  );
  /** Kontingentprobleme gegen die zuletzt geladenen Freischaltungen. */
  protected readonly quotaIssues = computed(() =>
    quotaProblems(
      this.day(),
      this.savedDays.get(this.day().date),
      this.costObjects(),
    ),
  );
  protected readonly canSubmit = computed(
    () =>
      canSubmitTimesheet(this.day(), this.window()) &&
      this.quotaIssues().length === 0,
  );
  /** Fachliche Probleme des Tages: Entwurfsregeln immer, Freigaberegeln sobald Positionen da sind. */
  protected readonly problems = computed(() => [
    ...validateTimesheetDay(
      this.day(),
      this.day().lines.length > 0 ? "submit" : "draft",
      this.window(),
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
    // Guard, Persona-Wechsel und beforeunload lesen den Zustand zentral.
    effect(() => this.unsaved.dirty.set(this.isDirty()));
    inject(DestroyRef).onDestroy(() => this.unsaved.dirty.set(false));
    void this.loadInitialData();
  }

  protected isBookable(costObject: EnabledCostObject): boolean {
    return isCostObjectBookable(costObject, this.day().date);
  }

  /** Oeffnet einen Tag; ausserhalb des geladenen Fensters wird nachgeladen. */
  protected openDate(date: string): void {
    if (!date) return;
    this.message.set("");
    this.requestedDate = date;
    if (!isWithinPeriod(this.loadedPeriod, date)) {
      void this.loadPeriod(date);
      return;
    }
    this.showDay(date);
  }

  private showDay(date: string): void {
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

  protected reload(): void {
    void this.loadPeriod(this.requestedDate);
  }

  protected async save(): Promise<void> {
    const problems = [
      ...validateTimesheetDay(this.day(), "draft", this.window()),
      ...this.quotaIssues(),
    ];
    if (problems.length > 0) {
      this.message.set(problems[0].message);
      return;
    }
    await this.busy.guard(async () => {
      try {
        const wasRejected = this.day().status === "A";
        const draft: TimesheetDay = {
          ...this.day(),
          status: "E",
          rejectionReason: undefined,
        };
        const saved = await this.persist(draft);
        this.message.set(
          wasRejected
            ? "Korrektur als Entwurf gespeichert."
            : "Entwurf gespeichert.",
        );
        this.day.set(saved);
      } catch (error) {
        this.message.set(this.saveErrorMessage(error));
      }
    });
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    await this.busy.guard(async () => {
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
    });
  }

  private async persist(day: TimesheetDay): Promise<TimesheetDay> {
    const saved = await this.timesheetService.saveTimesheet(day);
    this.savedDays.set(saved.date, saved);
    this.cacheVersion.update((version) => version + 1);
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

  /** Standardtag ist das Server-Heute (Audit Nr. 16), nicht der zuletzt gespeicherte Tag. */
  private loadInitialData(): Promise<void> {
    return this.loadPeriod(this.requestedDate);
  }

  /** Laedt Freischaltungen und die Tage des Fensters um `date`, oeffnet `date`. */
  private async loadPeriod(date: string): Promise<void> {
    const period = periodAround(date);
    await this.loader.track(
      () =>
        Promise.all([
          this.timesheetService.getEnabledCostObjects(),
          this.timesheetService.getMyTimesheets(period),
        ]),
      "Stundenzettel konnten nicht geladen werden.",
      ([costObjects, timesheets]) => {
        this.costObjects.set(costObjects);
        this.savedDays.clear();
        for (const day of timesheets) {
          this.savedDays.set(day.date, day);
        }
        this.loadedPeriod = period;
        this.cacheVersion.update((version) => version + 1);
        this.showDay(date);
        const extNr = this.currentExtNr();
        this.day.update((day) => ({ ...day, extNr }));
      },
    );
  }
}
