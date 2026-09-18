import { signal } from "@angular/core";

import { LoadState } from "../shared/async-state";
import { isWithinPeriod, periodAround } from "./timesheet.logic";
import type { DatePeriod } from "./timesheet.logic";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

/** Datenzugriff, den der Store braucht; `TimesheetService` erfuellt ihn. */
export interface TimesheetDayGateway {
  getEnabledCostObjects(): Promise<EnabledCostObject[]>;
  getMyTimesheets(period: DatePeriod): Promise<TimesheetDay[]>;
  saveTimesheet(day: TimesheetDay): Promise<TimesheetDay>;
}

export const LOAD_TIMESHEETS_ERROR =
  "Stundenzettel konnten nicht geladen werden.";

/**
 * Tages-Cache der Stundenschreibung (Audit Nr. 31, vorher in der
 * Komponente): gespeicherte Tage des geladenen Zeitfensters (Audit Nr. 16),
 * Freischaltungen und das zuletzt angeforderte Datum als Basis fuer den
 * Retry. Kein Root-Singleton: jeder Screen erzeugt seine eigene Instanz,
 * die mit ihm beim Identitaetswechsel zerstoert wird. Zusaetzlich ist der
 * Cache an die Identitaet gebunden, fuer die er geladen wurde: ein Laden fuer
 * eine andere `extNr` leert ihn sofort, und ueberholte Antworten werden
 * ueber `LoadState.track` verworfen.
 */
export class TimesheetDayStore {
  readonly loader = new LoadState();
  readonly costObjects = signal<EnabledCostObject[]>([]);
  private readonly days = signal<ReadonlyMap<string, TimesheetDay>>(new Map());
  private readonly period = signal<DatePeriod | null>(null);
  private readonly identity = signal<string | null>(null);
  private readonly requested = signal<string | null>(null);

  constructor(private readonly gateway: TimesheetDayGateway) {}

  /** Zuletzt angefordertes Datum (auch wenn das Laden scheiterte). */
  readonly requestedDate = this.requested.asReadonly();

  /** Gespeicherter Tag aus dem Fenster oder undefined (leerer Tag). */
  savedDay(date: string): TimesheetDay | undefined {
    return this.days().get(date);
  }

  /** Liegt `date` im geladenen Zeitfenster? */
  covers(date: string): boolean {
    return isWithinPeriod(this.period(), date);
  }

  /**
   * Laedt Freischaltungen und die Tage des Fensters um `date` fuer `extNr`.
   * Ergebnis `true`, wenn die Antwort uebernommen wurde; `false` bei Fehler
   * oder wenn ein neueres Laden sie ueberholt hat.
   */
  async loadAround(extNr: string, date: string): Promise<boolean> {
    if (this.identity() !== extNr) {
      // Fremde Daten duerfen nie unter der neuen Identitaet stehen bleiben.
      this.identity.set(extNr);
      this.days.set(new Map());
      this.period.set(null);
      this.costObjects.set([]);
    }
    this.requested.set(date);
    const period = periodAround(date);
    const result = await this.loader.track(
      () =>
        Promise.all([
          this.gateway.getEnabledCostObjects(),
          this.gateway.getMyTimesheets(period),
        ]),
      LOAD_TIMESHEETS_ERROR,
      ([costObjects, timesheets]) => {
        this.costObjects.set(costObjects);
        this.days.set(new Map(timesheets.map((day) => [day.date, day])));
        this.period.set(period);
      },
    );
    return result !== undefined;
  }

  /** Retry laedt das zuletzt angeforderte Fenster, nicht den angezeigten Tag. */
  async retry(extNr: string): Promise<boolean> {
    const date = this.requested();
    return date === null ? false : this.loadAround(extNr, date);
  }

  /**
   * Speichert einen Tag, uebernimmt den Serverstand in den Cache und laedt
   * die Reststunden neu, sonst zeigt das Kontingent-Panel alte Werte
   * (Audit Nr. 21) und die Kontingentpruefung rechnet mit ihnen.
   */
  async persist(day: TimesheetDay): Promise<TimesheetDay> {
    const saved = await this.gateway.saveTimesheet(day);
    this.days.update((days) => new Map(days).set(saved.date, saved));
    this.costObjects.set(await this.gateway.getEnabledCostObjects());
    return saved;
  }
}
