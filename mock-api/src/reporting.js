import {
  budgetTrafficLight,
  employees,
  enabledCostObjects,
} from "./fixtures.js";

// Verbraucht zaehlen nur genehmigte Stunden (Status G). Die verbindliche
// Budgetbetrachtung ab Status P/BANF (XTS-071) folgt erst mit Planung und
// Beauftragung (Epics 3/4); bis dahin ist die Freischaltung die Budgetquelle.
const APPROVED_STATUS = "G";

function displayNameFor(extNr) {
  return (
    employees.find((employee) => employee.extNr === extNr)?.displayName ?? extNr
  );
}

function trafficLightFor(percent) {
  if (percent >= budgetTrafficLight.criticalPercent) return "red";
  if (percent >= budgetTrafficLight.warnPercent) return "yellow";
  return "green";
}

function approvedLines(days) {
  return days
    .filter((day) => day.status === APPROVED_STATUS)
    .flatMap((day) =>
      day.lines.map((line) => ({
        extNr: day.extNr,
        date: day.date,
        coIdent: line.coIdent,
        description: line.description,
        hours: line.hours,
      })),
    );
}

// Einheitliche Reststunden-Quelle fuer Timesheet und Reporting:
// Rest = budgetHours der Freischaltung minus genehmigte Stunden (Status G).
export function withRemainingHours(items, days) {
  const lines = approvedLines(days);
  return items.map((item) => {
    const bookedHours = lines
      .filter(
        (line) => line.extNr === item.extNr && line.coIdent === item.coIdent,
      )
      .reduce((sum, line) => sum + line.hours, 0);
    return { ...item, remainingHours: item.budgetHours - bookedHours };
  });
}

export function buildBudgetMonitor(days, detail) {
  const lines = approvedLines(days);
  const byCoIdent = new Map();
  for (const item of enabledCostObjects) {
    const row = byCoIdent.get(item.coIdent) ?? {
      coIdent: item.coIdent,
      description: item.description.split(",")[0],
      budgetHours: 0,
    };
    row.budgetHours += item.budgetHours;
    byCoIdent.set(item.coIdent, row);
  }

  return [...byCoIdent.values()]
    .map((row) => {
      const rowLines = lines.filter((line) => line.coIdent === row.coIdent);
      const consumedHours = rowLines.reduce((sum, line) => sum + line.hours, 0);
      const consumedPercent =
        row.budgetHours > 0
          ? Math.round((consumedHours / row.budgetHours) * 1000) / 10
          : 0;
      const result = {
        ...row,
        consumedHours,
        consumedPercent,
        remainingHours: row.budgetHours - consumedHours,
        trafficLight: trafficLightFor(consumedPercent),
      };
      if (detail === "employee" || detail === "day") {
        const byEmployee = new Map();
        for (const line of rowLines) {
          const entry = byEmployee.get(line.extNr) ?? {
            extNr: line.extNr,
            displayName: displayNameFor(line.extNr),
            hours: 0,
            days: [],
          };
          entry.hours += line.hours;
          entry.days.push({
            date: line.date,
            description: line.description,
            hours: line.hours,
          });
          byEmployee.set(line.extNr, entry);
        }
        result.byEmployee = [...byEmployee.values()]
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .map((entry) =>
            detail === "day" ? entry : { ...entry, days: undefined },
          );
      }
      return result;
    })
    .sort((a, b) => a.coIdent.localeCompare(b.coIdent));
}

export function buildCostObjectQuota(days, filters) {
  const { lastName, team, from, to, detail } = filters;
  const lines = approvedLines(days).filter(
    (line) => (!from || line.date >= from) && (!to || line.date <= to),
  );

  return enabledCostObjects
    .map((item) => {
      const employee = employees.find(
        (candidate) => candidate.extNr === item.extNr,
      );
      const itemLines = lines.filter(
        (line) => line.extNr === item.extNr && line.coIdent === item.coIdent,
      );
      const bookedHours = itemLines.reduce((sum, line) => sum + line.hours, 0);
      const row = {
        extNr: item.extNr,
        displayName: employee?.displayName ?? item.extNr,
        lastName: employee?.lastName ?? item.extNr,
        teamId: employee?.teamId ?? null,
        coIdent: item.coIdent,
        description: item.description,
        validFrom: item.validFrom,
        validTo: item.validTo,
        budgetHours: item.budgetHours,
        bookedHours,
        remainingHours: item.budgetHours - bookedHours,
      };
      if (detail === "day") {
        row.days = itemLines
          .map(({ date, description, hours }) => ({
            date,
            description,
            hours,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }
      return row;
    })
    .filter(
      (row) =>
        !lastName ||
        row.lastName.toLowerCase().includes(lastName.toLowerCase()),
    )
    .filter((row) => !team || row.teamId === team)
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.coIdent.localeCompare(b.coIdent),
    );
}
