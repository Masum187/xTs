import { addHours, sumHours } from "../shared/hours";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

export function sumLineHours(lines: TimesheetDay["lines"]): number {
  return sumHours(lines.map((line) => line.hours));
}

export function canEditTimesheet(day: TimesheetDay): boolean {
  return day.status === "E" || day.status === "A";
}

export function canSubmitTimesheet(day: TimesheetDay): boolean {
  return (
    canEditTimesheet(day) &&
    day.lines.length > 0 &&
    sumLineHours(day.lines) > 0 &&
    validateTimesheetDay(day, "submit").length === 0
  );
}

export const HOURS_STEP = 0.25;
export const MAX_DAY_HOURS = 24;
export const MAX_DESCRIPTION_LENGTH = 255;

export type TimesheetValidationMode = "draft" | "submit";

export interface TimesheetProblem {
  field: string;
  code: string;
  message: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuarterStep(hours: number): boolean {
  return Math.abs(hours / HOURS_STEP - Math.round(hours / HOURS_STEP)) < 1e-9;
}

/**
 * Spiegelt die Server-Validierung (mock-api/src/timesheet-validation.js):
 * "draft" laesst unvollstaendige Entwuerfe zu, aber keine ungueltigen Werte;
 * "submit" verlangt vollstaendige Kopfdaten, Beschreibungen und Stunden > 0.
 */
export function validateTimesheetDay(
  day: TimesheetDay,
  mode: TimesheetValidationMode,
): TimesheetProblem[] {
  const problems: TimesheetProblem[] = [];
  const submitting = mode === "submit";
  const push = (field: string, code: string, message: string) =>
    problems.push({ field, code, message });

  if (!isValidTime(day.startTime)) {
    push(
      "startTime",
      "TIME_FORMAT",
      "Kommt muss eine Uhrzeit im Format HH:MM sein.",
    );
  }
  if (!isValidTime(day.endTime)) {
    push(
      "endTime",
      "TIME_FORMAT",
      "Geht muss eine Uhrzeit im Format HH:MM sein.",
    );
  }
  const timesValid = isValidTime(day.startTime) && isValidTime(day.endTime);
  const spanMinutes = timesValid
    ? minutesOf(day.endTime) - minutesOf(day.startTime)
    : null;
  if (spanMinutes !== null && spanMinutes <= 0) {
    push("endTime", "TIME_RANGE", "Geht muss nach Kommt liegen.");
  }
  if (!Number.isInteger(day.breakMinutes) || day.breakMinutes < 0) {
    push(
      "breakMinutes",
      "BREAK_INVALID",
      "Die Pause muss eine ganze Zahl von Minuten ab 0 sein.",
    );
  } else if (
    spanMinutes !== null &&
    spanMinutes > 0 &&
    day.breakMinutes >= spanMinutes
  ) {
    push(
      "breakMinutes",
      "BREAK_TOO_LONG",
      "Die Pause ist länger als die Anwesenheit.",
    );
  }

  let total = 0;
  day.lines.forEach((line, index) => {
    const position = `Position ${index + 1}`;
    const field = `lines[${index}]`;
    if (line.description.length > MAX_DESCRIPTION_LENGTH) {
      push(
        `${field}.description`,
        "DESCRIPTION_TOO_LONG",
        `${position}: Beschreibung darf höchstens ${MAX_DESCRIPTION_LENGTH} Zeichen haben.`,
      );
    } else if (submitting && !line.description.trim()) {
      push(
        `${field}.description`,
        "DESCRIPTION_REQUIRED",
        `${position}: Beschreibung ist für die Freigabe Pflicht.`,
      );
    }
    if (!Number.isFinite(line.hours)) {
      push(
        `${field}.hours`,
        "HOURS_INVALID",
        `${position}: Stunden müssen eine Zahl sein.`,
      );
      return;
    }
    if (
      line.hours < 0 ||
      line.hours > MAX_DAY_HOURS ||
      (submitting && line.hours === 0)
    ) {
      push(
        `${field}.hours`,
        "HOURS_RANGE",
        `${position}: Stunden müssen zwischen ${submitting ? "0,25" : "0"} und 24 liegen.`,
      );
      return;
    }
    if (!isQuarterStep(line.hours)) {
      push(
        `${field}.hours`,
        "HOURS_STEP",
        `${position}: Stunden nur in Viertelstunden (0,25).`,
      );
      return;
    }
    total += line.hours;
  });
  if (total > MAX_DAY_HOURS) {
    push(
      "lines",
      "DAY_HOURS_EXCEEDED",
      "Die Summe der Positionen darf 24 Stunden nicht überschreiten.",
    );
  }
  return problems;
}

export function isCostObjectBookable(
  costObject: EnabledCostObject,
  date: string,
): boolean {
  return (
    costObject.remainingHours > 0 &&
    costObject.validFrom <= date &&
    date <= costObject.validTo
  );
}

/**
 * Kontingentpruefung wie im Server (Audit Nr. 4): je Kontierung darf die
 * Tagessumme die offenen Stunden nicht ueberschreiten. `remainingHours`
 * aus MyEnabledCostObjects enthaelt bereits die gespeicherte Fassung dieses
 * Tages (Status E/F/G), daher wird sie wieder hinzugerechnet.
 */
export function quotaProblems(
  day: TimesheetDay,
  savedDay: TimesheetDay | undefined,
  costObjects: EnabledCostObject[],
): TimesheetProblem[] {
  const requested = new Map<string, number>();
  for (const line of day.lines) {
    if (!Number.isFinite(line.hours) || line.hours <= 0) continue;
    requested.set(
      line.coIdent,
      addHours(requested.get(line.coIdent) ?? 0, line.hours),
    );
  }
  const previouslyBooked = new Map<string, number>();
  if (savedDay && savedDay.status !== "A") {
    for (const line of savedDay.lines) {
      previouslyBooked.set(
        line.coIdent,
        addHours(previouslyBooked.get(line.coIdent) ?? 0, line.hours),
      );
    }
  }
  const problems: TimesheetProblem[] = [];
  for (const [coIdent, hours] of requested) {
    const costObject = costObjects.find((item) => item.coIdent === coIdent);
    if (!costObject) continue;
    const available = addHours(
      costObject.remainingHours,
      previouslyBooked.get(coIdent) ?? 0,
    );
    if (hours > available) {
      problems.push({
        field: "lines",
        code: "QUOTA_EXCEEDED",
        message: `Kontierung ${coIdent}: ${hours} Std. angefragt, aber nur ${available} Std. offen.`,
      });
    }
  }
  return problems;
}

export function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function createEmptyDay(extNr: string, date: string): TimesheetDay {
  return {
    extNr,
    date,
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "E",
    lines: [],
  };
}
