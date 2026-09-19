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
import { BusyState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import { formatSignedHours } from "../shared/hours";
import { ApprovalBadgeService } from "../shared/approval-badge.service";
import { UnsavedChangesService } from "../shared/unsaved-changes.service";

import {
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  dayVariance,
  defaultTimesheetDate,
  isCostObjectBookable,
  isSameTimesheet,
  isWeekend,
  isWithinPeriod,
  numberFieldValue,
  quotaProblems,
  shiftDate,
  sumLineHours,
  validateTimesheetDay,
  workHoursOf,
} from "./timesheet.logic";
import { AuthService } from "../auth/auth.service";
import { TimesheetDayStore } from "./timesheet-day.store";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./timesheet.component.css",
})
export class TimesheetComponent {
  private readonly auth = inject(AuthService);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly badge = inject(ApprovalBadgeService);
  /**
   * Tages-Cache und Ladezustand (Audit Nr. 31): eigene Instanz je Screen,
   * stirbt mit ihm beim Identitaetswechsel; der Entwurf `day` bleibt in der
   * Komponente. Scheitert ein Fensterwechsel, zeigt `day()` noch den alten
   * Tag, der Retry laedt aber das zuletzt angeforderte Fenster.
   */
  private readonly store = new TimesheetDayStore(inject(TimesheetService));
  protected readonly profile = this.auth.profile;

  protected readonly loader = this.store.loader;
  protected readonly busy = new BusyState();
  protected readonly costObjects = this.store.costObjects;
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
    const day = this.day();
    if (!day.date || !this.loader.ready()) return false;
    const baseline =
      this.store.savedDay(day.date) ?? createEmptyDay(day.extNr, day.date);
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
      this.store.savedDay(this.day().date),
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

  /** Eindeutige ID einer Problemzeile fuer `aria-describedby` (Audit Nr. 36). */
  protected problemId(problem: {
    field: string;
    code: string;
    coIdent?: string;
  }): string {
    return `problem-${problem.field}-${problem.code}-${problem.coIdent ?? ""}`
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/-+$/, "");
  }

  /**
   * IDs fuer ein Positionsfeld: eigene Probleme plus Gruppenfehler der
   * Positionen (`field: "lines"`, z. B. Tagessumme, Kontingent je Kontierung),
   * die am Stundenfeld haengen.
   */
  protected describedByLine(
    index: number,
    kind: "description" | "hours",
    coIdent: string,
  ): string | null {
    if (!this.canEdit()) return null;
    const own = `lines[${index}].${kind}`;
    const ids = this.problems()
      .filter(
        (problem) =>
          problem.field === own ||
          (kind === "hours" &&
            problem.field === "lines" &&
            (!problem.coIdent || problem.coIdent === coIdent)),
      )
      .map((problem) => this.problemId(problem));
    return ids.length > 0 ? ids.join(" ") : null;
  }

  /** IDs der Problemzeilen zu einem Feld, sonst null (Feld ist dann gueltig). */
  protected describedBy(field: string): string | null {
    if (!this.canEdit()) return null;
    const ids = this.problems()
      .filter((problem) => problem.field === field)
      .map((problem) => this.problemId(problem));
    return ids.length > 0 ? ids.join(" ") : null;
  }

  protected isBookable(costObject: EnabledCostObject): boolean {
    return isCostObjectBookable(costObject, this.day().date);
  }

  /**
   * Oeffnet einen Tag; ausserhalb des geladenen Fensters wird nachgeladen.
   * Ungespeicherte Aenderungen (Audit Nr. 19) werden nur nach Rueckfrage
   * verworfen; bei Abbruch bleiben Datum und Eingaben erhalten.
   */
  protected openDate(date: string, input?: HTMLInputElement): void {
    if (!date || date === this.day().date) return;
    if (!this.unsaved.confirmDiscard()) {
      if (input) input.value = this.day().date;
      return;
    }
    this.message.set("");
    if (!this.store.covers(date)) {
      void this.loadPeriod(date);
      return;
    }
    this.showDay(date);
  }

  private showDay(date: string): void {
    const saved = this.store.savedDay(date);
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

  /** Zahlenfelder liefern bei leerer Eingabe null (typisiert statt `+$event`). */
  protected setBreakMinutes(value: number | null): void {
    this.updateDay({ breakMinutes: numberFieldValue(value) });
  }

  protected setLineHours(index: number, value: number | null): void {
    this.updateLine(index, { hours: numberFieldValue(value) });
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
    void this.loadPeriod(
      this.store.requestedDate() ?? defaultTimesheetDate(this.profile()),
    );
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
        // Ein freigegebener eigener Tag kann in der eigenen Genehmigungsliste
        // erscheinen (Genehmiger mit Zustaendigkeit, admin): Badge nachziehen.
        void this.badge.refresh(this.profile());
      } catch (error) {
        this.message.set(this.saveErrorMessage(error));
      }
    });
  }

  private persist(day: TimesheetDay): Promise<TimesheetDay> {
    return this.store.persist(day);
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
    return this.loadPeriod(defaultTimesheetDate(this.profile()));
  }

  /**
   * Laedt Freischaltungen und die Tage des Fensters um `date` und oeffnet
   * `date`; eine ueberholte oder gescheiterte Antwort oeffnet nichts.
   */
  private async loadPeriod(date: string): Promise<void> {
    const applied = await this.store.loadAround(this.currentExtNr(), date);
    if (!applied) return;
    this.showDay(date);
    const extNr = this.currentExtNr();
    this.day.update((day) => ({ ...day, extNr }));
  }
}
