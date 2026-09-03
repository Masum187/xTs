// Payload-Validierung fuer POST /odata/TimesheetDays (Audit 2026-09-03 Nr. 3,
// 9, 17): Datum, Zeiten, Pause, Leistungsort und Positionen werden fachlich
// geprueft, bevor irgendetwas gespeichert oder aggregiert wird. Dieselben
// Regeln gelten im WebClient (frontend/src/app/timesheet/timesheet.logic.ts).

export const HOURS_STEP = 0.25;
export const MAX_DAY_HOURS = 24;
export const MAX_DESCRIPTION_LENGTH = 255;
export const LOCATIONS = ["remote", "on-site"];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value) {
  const match = typeof value === "string" && DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function minutesOf(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuarterStep(hours) {
  return Math.abs(hours / HOURS_STEP - Math.round(hours / HOURS_STEP)) < 1e-9;
}

function problem(field, code, message) {
  return { field, code, message };
}

/**
 * Prueft einen (bereits auf die Whitelist reduzierten) Tag. `status` "F"
 * verlangt vollstaendige Kopfdaten, Beschreibungen und Stunden > 0; "E"
 * erlaubt unvollstaendige Entwuerfe, aber keine ungueltigen Werte.
 */
export function validateTimesheetPayload(day, status) {
  const problems = [];
  const submitting = status === "F";

  if (!isValidDate(day.date)) {
    problems.push(
      problem(
        "date",
        "DATE_INVALID",
        "Das Tagesdatum ist kein gültiges Datum (JJJJ-MM-TT).",
      ),
    );
  }

  for (const field of ["startTime", "endTime"]) {
    const label = field === "startTime" ? "Kommt" : "Geht";
    if (day[field] === undefined) {
      if (submitting) {
        problems.push(
          problem(
            field,
            "TIME_REQUIRED",
            `${label} ist für die Freigabe Pflicht.`,
          ),
        );
      }
    } else if (!isValidTime(day[field])) {
      problems.push(
        problem(
          field,
          "TIME_FORMAT",
          `${label} muss eine Uhrzeit im Format HH:MM sein.`,
        ),
      );
    }
  }
  const timesValid = isValidTime(day.startTime) && isValidTime(day.endTime);
  const spanMinutes = timesValid
    ? minutesOf(day.endTime) - minutesOf(day.startTime)
    : null;
  if (timesValid && spanMinutes <= 0) {
    problems.push(
      problem("endTime", "TIME_RANGE", "Geht muss nach Kommt liegen."),
    );
  }

  if (day.breakMinutes !== undefined) {
    if (!Number.isInteger(day.breakMinutes) || day.breakMinutes < 0) {
      problems.push(
        problem(
          "breakMinutes",
          "BREAK_INVALID",
          "Die Pause muss eine ganze Zahl von Minuten ab 0 sein.",
        ),
      );
    } else if (
      spanMinutes !== null &&
      spanMinutes > 0 &&
      day.breakMinutes >= spanMinutes
    ) {
      problems.push(
        problem(
          "breakMinutes",
          "BREAK_TOO_LONG",
          "Die Pause ist länger als die Anwesenheit.",
        ),
      );
    }
  } else if (submitting) {
    problems.push(
      problem(
        "breakMinutes",
        "BREAK_REQUIRED",
        "Die Pause ist für die Freigabe Pflicht (0 ist erlaubt).",
      ),
    );
  }

  if (day.location === undefined) {
    if (submitting) {
      problems.push(
        problem(
          "location",
          "LOCATION_REQUIRED",
          "Der Leistungsort ist für die Freigabe Pflicht.",
        ),
      );
    }
  } else if (!LOCATIONS.includes(day.location)) {
    problems.push(
      problem(
        "location",
        "LOCATION_INVALID",
        "Der Leistungsort muss remote oder on-site sein.",
      ),
    );
  }

  if (!Array.isArray(day.lines)) {
    problems.push(
      problem(
        "lines",
        "LINES_INVALID",
        "Die Leistungspositionen müssen eine Liste sein.",
      ),
    );
    return problems;
  }
  let total = 0;
  day.lines.forEach((line, index) => {
    const position = `Position ${index + 1}`;
    const field = `lines[${index}]`;
    if (!line || typeof line !== "object") {
      problems.push(
        problem(field, "LINE_INVALID", `${position} ist unvollständig.`),
      );
      return;
    }
    if (typeof line.coIdent !== "string" || !line.coIdent.trim()) {
      problems.push(
        problem(
          `${field}.coIdent`,
          "COIDENT_REQUIRED",
          `${position}: Kontierung fehlt.`,
        ),
      );
    }
    if (
      line.description !== undefined &&
      typeof line.description !== "string"
    ) {
      problems.push(
        problem(
          `${field}.description`,
          "DESCRIPTION_INVALID",
          `${position}: Beschreibung muss Text sein.`,
        ),
      );
    } else if ((line.description ?? "").length > MAX_DESCRIPTION_LENGTH) {
      problems.push(
        problem(
          `${field}.description`,
          "DESCRIPTION_TOO_LONG",
          `${position}: Beschreibung darf höchstens ${MAX_DESCRIPTION_LENGTH} Zeichen haben.`,
        ),
      );
    } else if (submitting && !(line.description ?? "").trim()) {
      problems.push(
        problem(
          `${field}.description`,
          "DESCRIPTION_REQUIRED",
          `${position}: Beschreibung ist für die Freigabe Pflicht.`,
        ),
      );
    }
    if (typeof line.hours !== "number" || !Number.isFinite(line.hours)) {
      problems.push(
        problem(
          `${field}.hours`,
          "HOURS_INVALID",
          `${position}: Stunden müssen eine Zahl sein.`,
        ),
      );
      return;
    }
    if (
      line.hours < 0 ||
      line.hours > MAX_DAY_HOURS ||
      (submitting && line.hours === 0)
    ) {
      problems.push(
        problem(
          `${field}.hours`,
          "HOURS_RANGE",
          `${position}: Stunden müssen zwischen ${submitting ? "0,25" : "0"} und 24 liegen.`,
        ),
      );
      return;
    }
    if (!isQuarterStep(line.hours)) {
      problems.push(
        problem(
          `${field}.hours`,
          "HOURS_STEP",
          `${position}: Stunden nur in Viertelstunden (0,25).`,
        ),
      );
      return;
    }
    total += line.hours;
  });
  if (total > MAX_DAY_HOURS) {
    problems.push(
      problem(
        "lines",
        "DAY_HOURS_EXCEEDED",
        "Die Summe der Positionen darf 24 Stunden nicht überschreiten.",
      ),
    );
  }
  return problems;
}
