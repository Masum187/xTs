export type PlanningStatus = "V" | "F" | "P" | "B";

export interface PlanningMonth {
  month: string;
  availableHours: number;
}

export interface PlanningCell {
  month: string;
  hours: number;
  status: PlanningStatus | null;
  locked: boolean;
  overbooked: boolean;
}

export interface PlanningRow {
  extNr: string;
  displayName: string;
  teamId: string;
  coIdent: string;
  description: string;
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
