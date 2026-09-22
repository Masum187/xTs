export type PlanningStatus = "V" | "F" | "P" | "B";

/**
 * Monatskapazitaet (XTS-024). `source` nennt die Herkunft des Stundenwerts
 * im Mock; `workdays` und `holidays` sind `null`, weil der Mock keine
 * Arbeitstage und Feiertage fuehrt (nicht verfuegbar, nicht null Tage).
 */
export type CapacitySource = "explicit" | "fallback";

export interface PlanningMonth {
  month: string;
  availableHours: number;
  source: CapacitySource;
  workdays: number | null;
  holidays: number | null;
}

export interface PlanningCell {
  month: string;
  hours: number;
  status: PlanningStatus | null;
  valid: boolean;
  /** Keine gueltige Teamzuordnung im Planmonat (Konzept §10, Audit Nr. 22). */
  teamMissing?: boolean;
  locked: boolean;
  overbooked: boolean;
}

export interface PlanningRow {
  extNr: string;
  displayName: string;
  teamId: string;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  cells: PlanningCell[];
}

/**
 * Auslastung je Mitarbeiter und Monat (XTS-157), serverseitig ueber alle
 * Kontierungen des Mitarbeiters summiert; `utilizationPercent` ist null,
 * wenn der Werkkalender keine verfuegbaren Stunden hat.
 */
export interface PlanningUtilizationMonth {
  month: string;
  plannedHours: number;
  availableHours: number;
  utilizationPercent: number | null;
  overbooked: boolean;
}

export interface PlanningUtilization {
  extNr: string;
  displayName: string;
  months: PlanningUtilizationMonth[];
}

export interface PlanningOverview {
  months: PlanningMonth[];
  utilization: PlanningUtilization[];
  rows: PlanningRow[];
}

export interface PlanningFilters {
  extNr: string;
  team: string;
  coIdent: string;
}

export interface SaveEntryResult {
  entry: {
    extNr: string;
    coIdent: string;
    month: string;
    hours: number;
    status: PlanningStatus;
  };
  overbooked: boolean;
  availableHours: number;
  plannedTotal: number;
}
