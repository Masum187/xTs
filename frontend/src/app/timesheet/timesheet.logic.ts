import type { TimesheetDay } from "./timesheet.models";

export function sumLineHours(lines: TimesheetDay["lines"]): number {
  return lines.reduce((total, line) => total + line.hours, 0);
}

export function canSubmitTimesheet(day: TimesheetDay): boolean {
  return (
    day.status === "E" && day.lines.length > 0 && sumLineHours(day.lines) > 0
  );
}
