// Stundenarithmetik in ganzen Minuten (Audit 2026-09-03 Nr. 5), gespiegelt
// zur Mock-API (mock-api/src/hours.js): keine Gleitkomma-Reste in Summen,
// Reststunden oder Vergleichen. Anzeige ueber DecimalPipe mit Locale de.

export function toMinutes(hours: number): number {
  return Math.round((Number.isFinite(hours) ? hours : 0) * 60);
}

export function fromMinutes(minutes: number): number {
  return minutes / 60;
}

export function sumHours(values: readonly number[]): number {
  return fromMinutes(values.reduce((sum, value) => sum + toMinutes(value), 0));
}

export function addHours(a: number, b: number): number {
  return fromMinutes(toMinutes(a) + toMinutes(b));
}
