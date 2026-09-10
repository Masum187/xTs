export type PlanningStatus = "V" | "F" | "P" | "B";

export interface PlanningMonth {
  month: string;
  availableHours: number;
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

export interface PlanningOverview {
  months: PlanningMonth[];
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
