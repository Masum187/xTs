const START_MONTH_PATTERN = /^(0[1-9]|1[0-2])\.(\d{4})$/;

/** Parst die Startmonat-Eingabe `MM.YYYY` (XTS-020) nach `YYYY-MM`. */
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
