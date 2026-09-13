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

/**
 * Gueltige Auswahl fuer eine Liste (XTS-151): die bisherige, solange sie in
 * der Liste steht, sonst der erste Eintrag, bei leerer Liste keine.
 */
export function keepSelection(keys: string[], current: string): string {
  return keys.includes(current) ? current : (keys[0] ?? "");
}

/**
 * Auswahl nach einer erfolgreichen Aktion (XTS-151): der naechste Eintrag
 * der aktuellen Reihenfolge, beim letzten der vorherige, bei leerer Liste
 * keine Auswahl. `keys` ist die Reihenfolge vor dem Entfernen.
 */
export function nextSelectionAfter(keys: string[], removed: string): string {
  const index = keys.indexOf(removed);
  if (index < 0) return keys[0] ?? "";
  return keys[index + 1] ?? keys[index - 1] ?? "";
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
