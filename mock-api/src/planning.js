import { workCalendar } from "./fixtures.js";
import { percentOf, roundHours, sumHours, toMinutes } from "./hours.js";
import {
  availableAssignments,
  findEmployee,
  teamIdsFor,
} from "./masterdata.js";

const LOCKED_STATUSES = ["F", "P", "B"];

export const planningKey = (entry) =>
  `${entry.extNr}|${entry.coIdent}|${entry.month}`;

// Planstunden (Audit Nr. 22): Obergrenze und ganze Minuten (Kontrakt
// "Stundenwerte": Planung erlaubt beliebige Dezimalwerte, aber
// minutenpraezise), damit keine Werte wie 1e9 oder 0.333333 in Planung und
// Beauftragung laufen.
export const MAX_PLANNING_HOURS = 744;

export function isWholeMinutes(hours) {
  const minutes = hours * 60;
  return Math.abs(minutes - Math.round(minutes)) < 1e-6;
}

export function isValidPlanningHours(hours) {
  return (
    Number.isFinite(hours) &&
    hours >= 0 &&
    hours <= MAX_PLANNING_HOURS &&
    isWholeMinutes(hours)
  );
}

/** Konzept §10: Planung nur mit gueltiger Teamzuordnung im Planmonat. */
export function hasTeamForMonth(extNr, month) {
  return teamIdsFor(extNr, `${month}-01`, lastDayOfMonth(month)).length > 0;
}

export function isLockedStatus(status) {
  return LOCKED_STATUSES.includes(status);
}

export function availableHoursFor(month) {
  return workCalendar.months[month] ?? workCalendar.defaultHours;
}

/**
 * Monatskapazitaet (XTS-024). Der Mock fuehrt ausschliesslich Monatsstunden:
 * einige Monate explizit, alle uebrigen ueber einen Vorgabewert. Arbeitstage
 * und Feiertage gibt es nicht; sie werden als `null` = nicht verfuegbar
 * gemeldet und duerfen weder abgeleitet noch als 0 dargestellt werden.
 * `availableHours` kommt aus `availableHoursFor`, damit Kapazitaetsansicht,
 * verfuegbare Stunden der Matrix und Auslastung (XTS-157) dieselbe Quelle
 * haben. Ob die hinterlegten Monatswerte Feiertage beruecksichtigen, ist
 * ohne Herkunftsnachweis aus SAP nicht belegt.
 */
export function monthCapacity(month) {
  const explicit = Object.hasOwn(workCalendar.months, month);
  return {
    month,
    availableHours: availableHoursFor(month),
    source: explicit ? "explicit" : "fallback",
    workdays: null,
    holidays: null,
  };
}

export function buildMonthlyCapacity(start, count) {
  return monthsFrom(start, count).map((month) => monthCapacity(month));
}

export function monthsFrom(start, count = 12) {
  const [year, month] = start.split("-").map(Number);
  return Array.from({ length: count }, (_unused, index) => {
    const total = year * 12 + (month - 1) + index;
    const y = Math.floor(total / 12);
    const m = total % 12;
    return `${y}-${String(m + 1).padStart(2, "0")}`;
  });
}

export function isValidMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isMonthInRange(month, validFrom, validTo) {
  return month >= validFrom.slice(0, 7) && month <= validTo.slice(0, 7);
}

function lastDayOfMonth(month) {
  const [year, monthPart] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthPart, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * Gueltige Planungszeilen sind aktive, nicht geloeschte Mitarbeiter mit
 * Mitarbeiter-Kontierungs-Zuordnung auf eine nicht geloeschte Kontierung
 * (XTS-020: "gueltig und nicht geloescht"). Die Teamzugehoerigkeit wird
 * zeitlich aus ZXTS_MATEAM_T fuer den betrachteten Zeitraum ermittelt.
 */
export function planningCombinations(months = null) {
  return availableAssignments()
    .map((item) => {
      const employee = findEmployee(item.extNr);
      if (!employee?.active) return null;
      if (
        months &&
        !months.some((month) =>
          isMonthInRange(month, item.validFrom, item.validTo),
        )
      ) {
        return null;
      }
      const periodFrom = months ? `${months[0]}-01` : item.validFrom;
      const periodTo = months
        ? lastDayOfMonth(months[months.length - 1])
        : item.validTo;
      const teamIds = teamIdsFor(employee.extNr, periodFrom, periodTo);
      return {
        extNr: employee.extNr,
        displayName: employee.displayName,
        teamId: teamIds[0] ?? null,
        teamIds,
        coIdent: item.coIdent,
        description: item.description,
        validFrom: item.validFrom,
        validTo: item.validTo,
      };
    })
    .filter(Boolean);
}

/**
 * Auslastung je Mitarbeiter und Monat (XTS-157): Summe der Planstunden
 * ueber ALLE Kontierungen des Mitarbeiters in den Status V, F, P und B
 * (dieselbe Basis wie die Ueberplanungspruefung), geteilt durch die
 * verfuegbaren Stunden des Werkkalenders. Der Kontierungsfilter aendert die
 * Summe nicht; Mitarbeiter- und Teamfilter wirken ueber die Zeilenauswahl.
 * Ohne verfuegbare Stunden gibt es keinen Prozentwert (null), keine
 * Division und keine scheinbaren 0 %.
 */
export const UTILIZATION_STATUSES = ["V", "F", "P", "B"];

export function buildUtilization(rows, entries, months) {
  const employees = new Map();
  for (const row of rows) {
    if (!employees.has(row.extNr)) {
      employees.set(row.extNr, {
        extNr: row.extNr,
        displayName: row.displayName,
      });
    }
  }
  return [...employees.values()]
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.extNr.localeCompare(b.extNr),
    )
    .map((employee) => ({
      ...employee,
      months: months.map((month) => {
        const plannedHours = sumHours(
          entries
            .filter(
              (entry) =>
                entry.extNr === employee.extNr &&
                entry.month === month &&
                UTILIZATION_STATUSES.includes(entry.status),
            )
            .map((entry) => entry.hours),
        );
        const availableHours = availableHoursFor(month);
        const hasCapacity = toMinutes(availableHours) > 0;
        return {
          month,
          plannedHours,
          availableHours,
          utilizationPercent: hasCapacity
            ? percentOf(plannedHours, availableHours)
            : null,
          overbooked: toMinutes(plannedHours) > toMinutes(availableHours),
        };
      }),
    }));
}

export function buildPlanningOverview(entries, filters) {
  const { start, extNr, team, coIdent } = filters;
  const months = monthsFrom(start);
  const monthSet = new Set(months);

  const rows = planningCombinations(months)
    .filter((combo) => !extNr || combo.extNr === extNr)
    .filter((combo) => !team || combo.teamIds.includes(team))
    .filter((combo) => !coIdent || combo.coIdent === coIdent);

  // Ueberplanung (XTS-022): Summe aller Planstunden eines Mitarbeiters im
  // Monat gegen die verfuegbaren Stunden aus dem Werkkalender.
  const plannedPerEmployeeMonth = new Map();
  for (const entry of entries) {
    if (!monthSet.has(entry.month)) continue;
    const key = `${entry.extNr}|${entry.month}`;
    plannedPerEmployeeMonth.set(
      key,
      (plannedPerEmployeeMonth.get(key) ?? 0) + entry.hours,
    );
  }

  return {
    // Additiv (XTS-024): Herkunft und Datenverfuegbarkeit direkt am Monat,
    // damit die Planungsansicht die Kapazitaet ohne zweite Anfrage und ohne
    // Ableitung aus dem Zahlenwert zeigen kann.
    months: months.map((month) => monthCapacity(month)),
    utilization: buildUtilization(rows, entries, months),
    rows: rows.map((combo) => ({
      ...combo,
      cells: months.map((month) => {
        const entry = entries.find(
          (candidate) =>
            candidate.extNr === combo.extNr &&
            candidate.coIdent === combo.coIdent &&
            candidate.month === month,
        );
        const plannedTotal = roundHours(
          plannedPerEmployeeMonth.get(`${combo.extNr}|${month}`) ?? 0,
        );
        const teamMissing = !hasTeamForMonth(combo.extNr, month);
        const valid =
          isMonthInRange(month, combo.validFrom, combo.validTo) && !teamMissing;
        return {
          month,
          hours: entry?.hours ?? 0,
          status: entry?.status ?? null,
          valid,
          teamMissing,
          locked: !valid || (entry ? isLockedStatus(entry.status) : false),
          overbooked: plannedTotal > availableHoursFor(month),
        };
      }),
    })),
  };
}

export function upsertPlanningEntry(entries, payload) {
  const { extNr, coIdent, month } = payload;
  const hours = Number(payload.hours);
  if (!extNr || !coIdent || !isValidMonth(month) || Number.isNaN(hours)) {
    return { error: { status: 400, code: "INVALID_PLANNING_ENTRY" } };
  }
  if (!isValidPlanningHours(hours)) {
    return {
      error: {
        status: 400,
        code: "INVALID_PLANNING_HOURS",
        hours,
        max: MAX_PLANNING_HOURS,
      },
    };
  }
  const combination = planningCombinations([month]).find(
    (combo) => combo.extNr === extNr && combo.coIdent === coIdent,
  );
  if (!combination) {
    return { error: { status: 404, code: "UNKNOWN_PLANNING_COMBINATION" } };
  }
  if (!hasTeamForMonth(extNr, month)) {
    return {
      error: { status: 409, code: "TEAM_ASSIGNMENT_REQUIRED", extNr, month },
    };
  }
  const existing = entries.find(
    (candidate) =>
      candidate.extNr === extNr &&
      candidate.coIdent === coIdent &&
      candidate.month === month,
  );
  if (existing && isLockedStatus(existing.status)) {
    return { error: { status: 409, code: "PLANNING_ENTRY_LOCKED" } };
  }
  const saved = existing ?? { extNr, coIdent, month, status: "V", hours: 0 };
  saved.hours = hours;
  saved.status = "V";
  if (!existing) entries.push(saved);

  const plannedTotal = sumHours(
    entries
      .filter(
        (candidate) => candidate.extNr === extNr && candidate.month === month,
      )
      .map((candidate) => candidate.hours),
  );
  return {
    entry: { ...saved },
    overbooked: plannedTotal > availableHoursFor(month),
    availableHours: availableHoursFor(month),
    plannedTotal,
  };
}

export function releasePlanningEntry(entries, payload) {
  const { extNr, coIdent, month } = payload;
  const combination = planningCombinations([month]).find(
    (combo) => combo.extNr === extNr && combo.coIdent === coIdent,
  );
  if (!combination) {
    return { error: { status: 404, code: "UNKNOWN_PLANNING_COMBINATION" } };
  }
  const existing = entries.find(
    (candidate) =>
      candidate.extNr === extNr &&
      candidate.coIdent === coIdent &&
      candidate.month === month,
  );
  if (!existing) {
    return { error: { status: 404, code: "PLANNING_ENTRY_NOT_FOUND" } };
  }
  if (existing.status !== "V" || existing.hours <= 0) {
    return { error: { status: 409, code: "PLANNING_ENTRY_NOT_RELEASABLE" } };
  }
  // Konzept §10 gilt auch fuer die Freigabe: die Teamzuordnung kann seit dem
  // Speichern entfallen sein.
  if (!hasTeamForMonth(extNr, month)) {
    return {
      error: { status: 409, code: "TEAM_ASSIGNMENT_REQUIRED", extNr, month },
    };
  }
  existing.status = "F";
  return { entry: { ...existing } };
}
