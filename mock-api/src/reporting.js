import { budgetTrafficLight, costObjects, employees } from "./fixtures.js";
import {
  bookedLinesFor,
  buildEnablements,
  qualifyingOrders,
} from "./enablement.js";

// Verbraucht zaehlen im Reporting nur genehmigte Stunden (Status G). Budget
// ist seit Epic 5 die beauftragte Stundenmenge ab Status P/BANF (Regelwerk),
// nicht mehr eine statische Freischaltung.
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

export function buildBudgetMonitor(days, detail, orders, rules) {
  const lines = approvedLines(days);
  const byCoIdent = new Map();
  for (const order of qualifyingOrders(orders, rules)) {
    const row = byCoIdent.get(order.coIdent) ?? {
      coIdent: order.coIdent,
      description: (
        costObjects.find((item) => item.coIdent === order.coIdent)
          ?.description ?? order.coIdent
      ).split(",")[0],
      budgetHours: 0,
    };
    row.budgetHours += order.hours;
    byCoIdent.set(order.coIdent, row);
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

export function buildCostObjectQuota(days, filters, orders, rules) {
  const { lastName, team, from, to, detail } = filters;

  return buildEnablements(orders, days, rules)
    .map((enablement) => {
      const bookedLines = bookedLinesFor(
        days,
        enablement.extNr,
        enablement.coIdent,
      ).filter(
        (line) => (!from || line.date >= from) && (!to || line.date <= to),
      );
      const bookedHours = bookedLines.reduce(
        (sum, line) => sum + line.hours,
        0,
      );
      const row = {
        ...enablement,
        bookedHours,
        remainingHours: enablement.orderedHours - bookedHours,
      };
      if (detail === "day") {
        row.days = bookedLines;
      }
      return row;
    })
    .filter(
      (row) =>
        !lastName ||
        row.lastName.toLowerCase().includes(lastName.toLowerCase()),
    )
    .filter((row) => !team || row.teamId === team);
}
