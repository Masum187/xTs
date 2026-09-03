// Stundenarithmetik in ganzen Minuten (Audit 2026-09-03 Nr. 5): Summen,
// Differenzen und Prozentwerte werden ueber Minuten gebildet, damit keine
// Gleitkomma-Reste (0.1 + 0.2 = 0.30000000000000004) in Reststunden,
// Vergleiche oder Reports gelangen. Nach aussen bleiben Stunden Dezimalzahlen
// mit Minutenpraezision (OData Edm.Decimal).

export function toMinutes(hours) {
  return Math.round((Number(hours) || 0) * 60);
}

export function fromMinutes(minutes) {
  return minutes / 60;
}

/** Rundet einen Stundenwert auf Minutenpraezision. */
export function roundHours(hours) {
  return fromMinutes(toMinutes(hours));
}

export function sumHours(values) {
  return fromMinutes(values.reduce((sum, value) => sum + toMinutes(value), 0));
}

export function subtractHours(a, b) {
  return fromMinutes(toMinutes(a) - toMinutes(b));
}

/** Anteil in Prozent mit einer Nachkommastelle, minutenbasiert. */
export function percentOf(part, total) {
  const totalMinutes = toMinutes(total);
  if (totalMinutes <= 0) return 0;
  return Math.round((toMinutes(part) / totalMinutes) * 1000) / 10;
}
