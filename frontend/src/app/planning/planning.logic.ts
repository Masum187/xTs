const START_MONTH_PATTERN = /^(0[1-9]|1[0-2])\.(\d{4})$/;

/** Parst die Startmonat-Eingabe `MM.YYYY` (XTS-020) nach `YYYY-MM`. */
export const MAX_PLANNING_HOURS = 744;

/**
 * Dieselbe Regel wie die Mock-API (Audit Nr. 22): 0 bis 744 Stunden in
 * ganzen Minuten. Liefert die Meldung oder null, wenn gueltig.
 */
export function planningHoursProblem(rawValue: string): string | null {
  const hours = Number(rawValue);
  if (rawValue.trim() === "" || Number.isNaN(hours)) {
    return "Planstunden müssen eine Zahl sein.";
  }
  if (hours < 0 || hours > MAX_PLANNING_HOURS) {
    return `Planstunden müssen zwischen 0 und ${MAX_PLANNING_HOURS} liegen.`;
  }
  const minutes = hours * 60;
  if (Math.abs(minutes - Math.round(minutes)) > 1e-6) {
    return "Planstunden müssen ganzen Minuten entsprechen (z. B. 8,25 oder 7,1).";
  }
  return null;
}

export function parseStartMonth(input: string): string | null {
  const match = START_MONTH_PATTERN.exec(input.trim());
  if (!match) return null;
  return `${match[2]}-${match[1]}`;
}

/** Formatiert `YYYY-MM` als Anzeigeformat `MM.YYYY`. */
export function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split("-");
  return `${monthPart}.${year}`;
}

/** Sichtbare Monate je Seite der Planungsmatrix (XTS-152). */
export const MONTHS_PER_PAGE = 4;

/** Stabiler Schluessel einer Zelle aus Mitarbeiter, Kontierung und Monat. */
export function cellKey(extNr: string, coIdent: string, month: string): string {
  return `${extNr}|${coIdent}|${month}`;
}

export function pageCount(total: number, perPage = MONTHS_PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Sichtbarer Ausschnitt (1-basiert) einer Seite, z. B. 5 bis 8 von 12. */
export function pageRange(
  page: number,
  total: number,
  perPage = MONTHS_PER_PAGE,
): { from: number; to: number; total: number } {
  const from = Math.min(page * perPage + 1, Math.max(total, 1));
  return { from, to: Math.min(page * perPage + perPage, total), total };
}

/** Ausschnitt einer Liste fuer eine Seite. */
export function pageSlice<T>(
  items: T[],
  page: number,
  perPage = MONTHS_PER_PAGE,
): T[] {
  return items.slice(page * perPage, page * perPage + perPage);
}
