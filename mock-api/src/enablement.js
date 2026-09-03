import {
  costObjectDescription,
  findCostObject,
  findEmployee,
  store,
  teamIdsFor,
} from "./masterdata.js";

// Kontierungsfreischaltung analog ZXTS_MAZUKONT_T (XTS-041/042): abgeleitet
// aus den Beauftragungen gemaess Regelwerk. Die Fortschreibung von TS_STUNDEN/
// OFFENE_STUNDEN passiert implizit bei jedem Zugriff, weil die Werte aus dem
// aktuellen Buchungsbestand berechnet werden; eine Nightly Reconciliation ist
// im Mock dadurch gegenstandslos und bleibt der SAP-Implementierung
// vorbehalten.

/** Gebuchte Stunden zaehlen ab Speichern/Freigeben (E/F/G), nicht erst ab
 * Genehmigung — zurueckgewiesene Tage (A) geben ihr Kontingent wieder frei. */
const BOOKED_STATUSES = ["E", "F", "G"];

export function activeRule(rules, infotype) {
  return rules.find((rule) => rule.infotype === infotype && rule.active);
}

/** Regel Infotyp 2: P = Freischaltung ab BANF, B = erst ab Bestellung. */
export function qualifyingOrderStatuses(rules) {
  const rule = activeRule(rules, 2);
  if (!rule) return [];
  return rule.value === "B" ? ["bestellt"] : ["banf", "bestellt"];
}

export function qualifyingOrders(orders, rules) {
  const statuses = qualifyingOrderStatuses(rules);
  return orders.filter((order) => statuses.includes(order.status));
}

function lastDayOfMonth(month) {
  const [year, monthPart] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthPart, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

function descriptionFor(extNr, coIdent) {
  const assignment = store.assignments.find(
    (item) => item.extNr === extNr && item.coIdent === coIdent,
  );
  if (assignment) return assignment.description;
  return costObjectDescription(coIdent);
}

export function bookedHoursFor(days, extNr, coIdent) {
  return days
    .filter(
      (day) => day.extNr === extNr && BOOKED_STATUSES.includes(day.status),
    )
    .flatMap((day) => day.lines)
    .filter((line) => line.coIdent === coIdent)
    .reduce((sum, line) => sum + line.hours, 0);
}

export function bookedLinesFor(days, extNr, coIdent) {
  return days
    .filter(
      (day) => day.extNr === extNr && BOOKED_STATUSES.includes(day.status),
    )
    .flatMap((day) =>
      day.lines
        .filter((line) => line.coIdent === coIdent)
        .map((line) => ({
          date: day.date,
          status: day.status,
          description: line.description,
          hours: line.hours,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Erzeugt die Freischaltungen: Aggregation je Mitarbeiter und Kontierung
 * (Regel Infotyp 1), beauftragte Stunden und Zeitraum aus den qualifizierenden
 * Beauftragungen, offene Stunden = beauftragt minus gebucht. Geloeschte
 * Kontierungen (XTS-013) werden nicht mehr angeboten.
 */
export function buildEnablements(orders, days, rules) {
  const byCombo = new Map();
  for (const order of qualifyingOrders(orders, rules)) {
    if (!findCostObject(order.coIdent)) continue;
    const key = `${order.extNr}|${order.coIdent}`;
    const entry = byCombo.get(key) ?? {
      extNr: order.extNr,
      coIdent: order.coIdent,
      description: descriptionFor(order.extNr, order.coIdent),
      orderedHours: 0,
      periodFrom: order.periodFrom,
      periodTo: order.periodTo,
    };
    entry.orderedHours += order.hours;
    if (order.periodFrom < entry.periodFrom) {
      entry.periodFrom = order.periodFrom;
    }
    if (order.periodTo > entry.periodTo) entry.periodTo = order.periodTo;
    byCombo.set(key, entry);
  }

  return [...byCombo.values()]
    .map((entry) => {
      const bookedHours = bookedHoursFor(days, entry.extNr, entry.coIdent);
      const employee = findEmployee(entry.extNr);
      const validFrom = `${entry.periodFrom}-01`;
      const validTo = lastDayOfMonth(entry.periodTo);
      const teamIds = teamIdsFor(entry.extNr, validFrom, validTo);
      return {
        extNr: entry.extNr,
        displayName: employee?.displayName ?? entry.extNr,
        lastName: employee?.lastName ?? entry.extNr,
        teamId: teamIds[0] ?? null,
        teamIds,
        coIdent: entry.coIdent,
        description: entry.description,
        validFrom,
        validTo,
        orderedHours: entry.orderedHours,
        bookedHours,
        remainingHours: entry.orderedHours - bookedHours,
      };
    })
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.coIdent.localeCompare(b.coIdent),
    );
}

/**
 * Kontingentpruefung beim Speichern (XTS-042, Audit Nr. 4): je Kontierung
 * wird die Tagessumme der Positionen gegen die offenen Stunden geprueft, die
 * sich ohne die bisherige Fassung dieses Tages ergeben (Upsert). Fehlende
 * oder abgelaufene Freischaltung: COST_OBJECT_NOT_ENABLED; Ueberschreitung:
 * COST_OBJECT_QUOTA_EXCEEDED mit angefragten und offenen Stunden.
 * Wettlaeufe zwischen zwei Speichervorgaengen verhindert der Mock nur durch
 * seine Single-Thread-Verarbeitung; SAP-seitig ist eine Sperre je
 * Mitarbeiter und Kontierung noetig (Kontrakt).
 */
export function validateTimesheetEnablement(day, days, orders, rules) {
  const lines = Array.isArray(day.lines) ? day.lines : [];
  if (day.status === "A" || lines.length === 0) return null;

  const otherDays = days.filter(
    (existing) => existing.extNr !== day.extNr || existing.date !== day.date,
  );
  const enablements = buildEnablements(orders, otherDays, rules);

  const requestedByCoIdent = new Map();
  for (const line of lines) {
    requestedByCoIdent.set(
      line.coIdent,
      (requestedByCoIdent.get(line.coIdent) ?? 0) + (Number(line.hours) || 0),
    );
  }

  for (const [coIdent, requested] of requestedByCoIdent) {
    const enabled = enablements.find(
      (item) =>
        item.extNr === day.extNr &&
        item.coIdent === coIdent &&
        item.validFrom <= day.date &&
        day.date <= item.validTo,
    );
    if (!enabled) {
      return { status: 409, code: "COST_OBJECT_NOT_ENABLED", coIdent };
    }
    if (requested > enabled.remainingHours) {
      return {
        status: 409,
        code: "COST_OBJECT_QUOTA_EXCEEDED",
        coIdent,
        requested,
        remaining: enabled.remainingHours,
      };
    }
  }
  return null;
}
