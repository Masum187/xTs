import { budgetTrafficLight } from "./fixtures.js";
import {
  bookedLinesFor,
  buildEnablements,
  qualifyingOrders,
} from "./enablement.js";
import { percentOf, roundHours, subtractHours, sumHours } from "./hours.js";
import { costObjectDescription, displayNameFor } from "./masterdata.js";

// Verbraucht zaehlen im Reporting nur genehmigte Stunden (Status G). Budget
// ist seit Epic 5 die beauftragte Stundenmenge ab Status P/BANF (Regelwerk),
// nicht mehr eine statische Freischaltung.
const APPROVED_STATUS = "G";

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
      description: costObjectDescription(order.coIdent).split(",")[0],
      budgetHours: 0,
    };
    row.budgetHours += order.hours;
    byCoIdent.set(order.coIdent, row);
  }

  return [...byCoIdent.values()]
    .map((row) => {
      const rowLines = lines.filter((line) => line.coIdent === row.coIdent);
      const budgetHours = roundHours(row.budgetHours);
      const consumedHours = sumHours(rowLines.map((line) => line.hours));
      const consumedPercent = percentOf(consumedHours, budgetHours);
      const result = {
        ...row,
        budgetHours,
        consumedHours,
        consumedPercent,
        remainingHours: subtractHours(budgetHours, consumedHours),
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
          entry.hours = sumHours([entry.hours, line.hours]);
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
      const bookedHours = sumHours(bookedLines.map((line) => line.hours));
      const row = {
        ...enablement,
        bookedHours,
        remainingHours: subtractHours(enablement.orderedHours, bookedHours),
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
    .filter((row) => !team || row.teamIds.includes(team));
}
