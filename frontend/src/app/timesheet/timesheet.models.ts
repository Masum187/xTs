export type TimesheetStatus = "E" | "F" | "G" | "A";

export interface EmployeeProfile {
  extNr: string;
  displayName: string;
  company: string;
}

export interface EnabledCostObject {
  id: string;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  remainingHours: number;
}

export interface TimesheetLine {
  coIdent: string;
  description: string;
  hours: number;
}

export interface TimesheetDay {
  extNr: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  location: "remote" | "on-site";
  status: TimesheetStatus;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  weDocument?: string;
  lines: TimesheetLine[];
}

export interface ApprovalDay extends TimesheetDay {
  displayName: string;
}
