import { DecimalPipe } from "@angular/common";
import type { ElementRef } from "@angular/core";
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { describeApiError } from "../shared/api-error";
import { BusyState, LoadState } from "../shared/async-state";
import { LoadStatusComponent } from "../shared/load-status.component";
import { formatHours } from "../shared/hours";

import type { Team } from "../reporting/reporting.models";
import { ReportingService } from "../reporting/reporting.service";
import {
  cellKey,
  formatMonthLabel,
  pageCount,
  pageRange,
  pageSlice,
  parseStartMonth,
  planningHoursProblem,
} from "./planning.logic";
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

interface SelectedCell {
  row: PlanningRow;
  cell: PlanningCell;
}

/** Screen-lokaler Umbruch: Matrix und Zelleneditor nebeneinander ab 1280 px. */
const STACKED_QUERY = "(max-width: 1279px)";

export const DISCARD_PLAN_MESSAGE =
  "Es gibt ungespeicherte Planstunden im Zelleneditor. Änderungen verwerfen?";

@Component({
  selector: "xts-planning",
  imports: [DecimalPipe, FormsModule, LoadStatusComponent],
  templateUrl: "./planning.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./planning.component.css",
})
export class PlanningComponent {
  private readonly planningService = inject(PlanningService);
  private readonly reportingService = inject(ReportingService);
  private readonly injector = inject(Injector);

  protected readonly loader = new LoadState();
  protected readonly busy = new BusyState();
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

  // XTS-152: Matrix als Ausschnitt von vier Monaten mit Pager und
  // Zelleneditor. Seite und Auswahl sind rein praesentativ.
  protected readonly page = signal<number>(0);
  protected readonly pageCount = computed(() =>
    pageCount(this.monthLabels().length),
  );
  protected readonly pageRange = computed(() =>
    pageRange(this.page(), this.monthLabels().length),
  );
  protected readonly visibleMonths = computed(() =>
    pageSlice(this.monthLabels(), this.page()),
  );
  /**
   * Ausgewaehlte Zelle, Schluessel aus Mitarbeiter, Kontierung und Monat.
   * Verschwindet die Zelle durch Filter, Seite oder Nachladen, ist die
   * Auswahl aufgehoben; nach Speichern oder Freigeben bleibt sie bestehen.
   */
  protected readonly selectedKey = linkedSignal<
    { overview: PlanningOverview | null; page: number },
    string
  >({
    source: computed(() => ({ overview: this.overview(), page: this.page() })),
    computation: ({ overview, page }, previous) => {
      const current = previous?.value ?? "";
      const visible = (overview?.rows ?? []).some((row) =>
        pageSlice(row.cells, page).some(
          (cell) => cellKey(row.extNr, row.coIdent, cell.month) === current,
        ),
      );
      return visible ? current : "";
    },
  });
  protected readonly selectedCell = computed<SelectedCell | null>(() => {
    const key = this.selectedKey();
    if (!key) return null;
    for (const row of this.overview()?.rows ?? []) {
      const cell = row.cells.find(
        (item) => cellKey(row.extNr, row.coIdent, item.month) === key,
      );
      if (cell) return { row, cell };
    }
    return null;
  });
  /** Eingabe im Editor, solange sie nicht dem Serverstand entspricht. */
  protected readonly draft = signal<string | null>(null);
  protected readonly editorValue = computed(() => {
    const draft = this.draft();
    if (draft !== null) return draft;
    const hours = this.selectedCell()?.cell.hours ?? 0;
    return hours > 0 ? String(hours) : "";
  });
  protected readonly hasUnsavedDraft = computed(() => {
    const draft = this.draft();
    const selected = this.selectedCell();
    return (
      draft !== null &&
      selected !== null &&
      Number(draft) !== selected.cell.hours
    );
  });
  private readonly editor = viewChild<ElementRef<HTMLElement>>("editor");

  constructor() {
    // Ohne Auswahl gibt es keinen Entwurf.
    effect(() => {
      if (!this.selectedKey()) this.draft.set(null);
    });
    void this.reportingService.getTeams().then((teams) => {
      this.teams.set(teams);
    });
    void this.load(true);
  }

  protected visibleCells(row: PlanningRow): PlanningCell[] {
    return pageSlice(row.cells, this.page());
  }

  protected isSelected(row: PlanningRow, cell: PlanningCell): boolean {
    return cellKey(row.extNr, row.coIdent, cell.month) === this.selectedKey();
  }

  protected availableHoursFor(month: string): number {
    return (
      this.overview()?.months.find((entry) => entry.month === month)
        ?.availableHours ?? 0
    );
  }

  /**
   * Kachel auswaehlen. Waehrend einer Aktion gesperrt; ein ungespeicherter
   * Entwurf wird nur nach Rueckfrage verworfen. Auch die bereits gewaehlte
   * Kachel fuehrt zum Editor (unter 1280 px liegt er unter der Matrix).
   */
  protected selectCell(row: PlanningRow, cell: PlanningCell): void {
    if (this.busy.active()) return;
    const key = cellKey(row.extNr, row.coIdent, cell.month);
    if (key !== this.selectedKey()) {
      if (!this.confirmDiscard()) return;
      this.selectedKey.set(key);
    }
    this.revealEditor();
  }

  protected goToPage(delta: number): void {
    if (this.busy.active()) return;
    const next = Math.min(
      Math.max(this.page() + delta, 0),
      this.pageCount() - 1,
    );
    if (next === this.page() || !this.confirmDiscard()) return;
    this.page.set(next);
  }

  /** Startmonat aus dem Feld uebernehmen; Seite 1, Rueckfrage bei Entwurf. */
  protected onStartInput(target: HTMLInputElement): void {
    if (!this.confirmDiscard()) {
      target.value = this.startInput();
      return;
    }
    this.page.set(0);
    void this.onStartChange(target.value);
  }

  protected onFilterInput(
    field: "extNr" | "team" | "coIdent",
    target: HTMLSelectElement,
  ): void {
    if (!this.confirmDiscard()) {
      target.value = {
        extNr: this.filterExtNr(),
        team: this.filterTeam(),
        coIdent: this.filterCoIdent(),
      }[field];
      return;
    }
    void this.updateFilter({ [field]: target.value });
  }

  /**
   * Eingabe speichern (Enter oder Verlassen des Feldes). Bei Erfolg zeigt
   * dieselbe Zelle den Serverstand, bei Fehler oder ungueltiger Eingabe
   * bleibt der Wert im Editor stehen.
   */
  protected async commitDraft(value: string): Promise<void> {
    const selected = this.selectedCell();
    if (!selected) return;
    this.draft.set(value);
    await this.saveCell(selected.row, selected.cell, value);
    const current = this.selectedCell();
    if (current && Number(value) === current.cell.hours) this.draft.set(null);
  }

  private confirmDiscard(): boolean {
    if (!this.hasUnsavedDraft()) return true;
    if (!window.confirm(DISCARD_PLAN_MESSAGE)) return false;
    this.draft.set(null);
    return true;
  }

  private revealEditor(): void {
    if (!window.matchMedia(STACKED_QUERY).matches) return;
    // Erst nach dem Rendern des Editorinhalts scrollen, sonst reicht die
    // Seitenhoehe noch nicht bis zum Editor.
    afterNextRender(
      () => this.editor()?.nativeElement.scrollIntoView({ block: "start" }),
      { injector: this.injector },
    );
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

  protected reload(): void {
    void this.load();
  }

  protected async saveCell(
    row: PlanningRow,
    cell: PlanningCell,
    rawValue: string,
  ): Promise<void> {
    const problem = planningHoursProblem(rawValue);
    if (problem !== null) {
      this.message.set(problem);
      return;
    }
    const hours = Number(rawValue);
    await this.busy.guard(async () => {
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
            ? `Überplanung: ${formatHours(result.plannedTotal)} Std. geplant bei ${formatHours(result.availableHours)} Std. verfügbar (${row.displayName}, ${this.formatMonth(cell.month)}).`
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
    });
  }

  protected async releaseCell(
    row: PlanningRow,
    cell: PlanningCell,
  ): Promise<void> {
    await this.busy.guard(async () => {
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
    });
  }

  private async load(initial = false): Promise<void> {
    const start = parseStartMonth(this.startInput());
    if (!start) {
      this.startError.set(true);
      return;
    }
    this.startError.set(false);
    const overview = await this.loader.track(
      () =>
        this.planningService.getOverview(start, {
          extNr: this.filterExtNr(),
          team: this.filterTeam(),
          coIdent: this.filterCoIdent(),
        }),
      "Planungsübersicht konnte nicht geladen werden.",
      (result) => this.overview.set(result),
    );
    // undefined = Fehler oder von einem neueren Ladevorgang ueberholt.
    if (!overview) return;
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
