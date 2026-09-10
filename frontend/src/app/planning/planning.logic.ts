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
