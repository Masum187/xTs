import type { ApprovalDay } from "../timesheet/timesheet.models";

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function uniqueMonths(days: ApprovalDay[]): string[] {
  return [...new Set(days.map((day) => monthOf(day.date)))].sort((a, b) =>
    b.localeCompare(a),
  );
}

export function uniqueEmployees(
  days: ApprovalDay[],
): { extNr: string; displayName: string }[] {
  const byExtNr = new Map(
    days.map((day) => [day.extNr, day.displayName] as const),
  );
  return [...byExtNr.entries()]
    .map(([extNr, displayName]) => ({ extNr, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function filterApprovals(
  days: ApprovalDay[],
  month: string,
  extNr: string,
): ApprovalDay[] {
  return days
    .filter((day) => !month || monthOf(day.date) === month)
    .filter((day) => !extNr || day.extNr === extNr);
}
