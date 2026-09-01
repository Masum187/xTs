export type BudgetDetailLevel = "none" | "employee" | "day";

export type TrafficLight = "green" | "yellow" | "red";

export interface BudgetDayDetail {
  date: string;
  description: string;
  hours: number;
}

export interface BudgetEmployeeDetail {
  extNr: string;
  displayName: string;
  hours: number;
  days?: BudgetDayDetail[];
}

export interface BudgetRow {
  coIdent: string;
  description: string;
  budgetHours: number;
  consumedHours: number;
  consumedPercent: number;
  remainingHours: number;
  trafficLight: TrafficLight;
  byEmployee?: BudgetEmployeeDetail[];
}

export interface QuotaFilters {
  lastName: string;
  team: string;
  from: string;
  to: string;
  detail: "none" | "day";
}

export interface QuotaRow {
  extNr: string;
  displayName: string;
  lastName: string;
  teamId: string | null;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  budgetHours: number;
  bookedHours: number;
  remainingHours: number;
  days?: BudgetDayDetail[];
}

export interface Team {
  id: string;
  name: string;
}
