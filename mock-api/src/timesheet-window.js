// Datumsregeln der Stundenerfassung (Entscheidung 18, Audit Nr. 17):
// erfassbar sind der laufende Monat und der Vormonat; der Vormonat nur bis
// einschliesslich zum Tag "Monatsabschluss" (Regelwerk Infotyp 3) des
// laufenden Monats. Zukunft ist gesperrt. Ist die Regel inaktiv, gibt es
// keinen Monatsabschluss und der Vormonat bleibt den ganzen Monat offen.
// Das Systemdatum kann fuer Tests mit XTS_TODAY (JJJJ-MM-TT) gesetzt werden.

import { isValidDate } from "./timesheet-validation.js";

export const CLOSING_DAY_INFOTYPE = 3;
export const DEFAULT_CLOSING_DAY = 5;
export const MAX_CLOSING_DAY = 28;

function isoLocal(now) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Heutiger Kalendertag (lokal) oder das Testdatum aus XTS_TODAY. */
export function systemToday(now = new Date()) {
  const fixed = process.env.XTS_TODAY;
  return fixed && isValidDate(fixed) ? fixed : isoLocal(now);
}

export function isValidClosingDay(value) {
  const day = Number(value);
  return (
    typeof value === "string" &&
    /^\d{1,2}$/.test(value) &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= MAX_CLOSING_DAY
  );
}

/** Monatsabschluss aus dem Regelwerk: Kalendertag oder null (Regel inaktiv). */
export function closingDayOf(rules) {
  const rule = rules.find((item) => item.infotype === CLOSING_DAY_INFOTYPE);
  if (!rule || !rule.active) return null;
  return isValidClosingDay(rule.value)
    ? Number(rule.value)
    : DEFAULT_CLOSING_DAY;
}

function firstOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

/** Erfassbarer Zeitraum (inklusive) fuer `today` und den Monatsabschluss. */
export function timesheetWindow(today, closingDay) {
  const [year, month, day] = today.split("-").map(Number);
  const previousMonthOpen = closingDay === null || day <= closingDay;
  const from = previousMonthOpen
    ? firstOfMonth(year, month - 2)
    : firstOfMonth(year, month - 1);
  return { from, to: today };
}

export function isWithinWindow(date, window) {
  return date >= window.from && date <= window.to;
}

export function currentTimesheetWindow(rules, today = systemToday()) {
  return timesheetWindow(today, closingDayOf(rules));
}
