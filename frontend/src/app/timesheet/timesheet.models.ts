export type TimesheetStatus = "E" | "F" | "G" | "A";

export interface EnabledCostObject {
  extNr: string;
  coIdent: string;
  description: string;
  validFrom: string;
  validTo: string;
  orderedHours: number;
  bookedHours: number;
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
  /** Servergefuehrte Arbeitszeit aus Kommt, Geht und Pause (Stunden) oder null. */
  workHours?: number | null;
  /** Begruendung, wenn die Positionssumme von der Arbeitszeit abweicht. */
  varianceReason?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  weDocument?: string;
  lines: TimesheetLine[];
}

export interface ApprovalDay extends TimesheetDay {
  displayName: string;
  /**
   * Kontierungen des Tages, fuer die die angemeldete Person zustaendig ist
   * (Entscheidung 19); admin: alle Kontierungen des Tages.
   */
  responsibleCoIdents: string[];
}
