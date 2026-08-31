import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

export function sumLineHours(lines: TimesheetDay["lines"]): number {
  return lines.reduce((total, line) => total + line.hours, 0);
}

export function canEditTimesheet(day: TimesheetDay): boolean {
  return day.status === "E" || day.status === "A";
}

export function canSubmitTimesheet(day: TimesheetDay): boolean {
  return (
    canEditTimesheet(day) && day.lines.length > 0 && sumLineHours(day.lines) > 0
  );
}

export function isCostObjectBookable(
  costObject: EnabledCostObject,
  date: string,
): boolean {
  return (
    costObject.remainingHours > 0 &&
    costObject.validFrom <= date &&
    date <= costObject.validTo
  );
}

export function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function createEmptyDay(extNr: string, date: string): TimesheetDay {
  return {
    extNr,
    date,
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "E",
    lines: [],
  };
}
