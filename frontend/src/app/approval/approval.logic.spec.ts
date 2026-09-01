import { describe, expect, it } from "vitest";

import type { ApprovalDay } from "../timesheet/timesheet.models";
import {
  filterApprovals,
  monthOf,
  uniqueEmployees,
  uniqueMonths,
} from "./approval.logic";

function approvalDay(
  extNr: string,
  displayName: string,
  date: string,
): ApprovalDay {
  return {
    extNr,
    displayName,
    date,
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "F",
    lines: [{ coIdent: "700000000004", description: "Arbeit", hours: 8 }],
  };
}

const days: ApprovalDay[] = [
  approvalDay("SCHILZ", "Stephan Schilz", "2026-04-08"),
  approvalDay("ROEPER", "Christian Roeper", "2026-04-08"),
  approvalDay("ROEPER", "Christian Roeper", "2026-03-31"),
];

describe("approval logic", () => {
  it("extracts the month of a date", () => {
    expect(monthOf("2026-04-08")).toBe("2026-04");
  });

  it("lists unique months newest first", () => {
    expect(uniqueMonths(days)).toEqual(["2026-04", "2026-03"]);
  });

  it("lists unique employees sorted by name", () => {
    expect(uniqueEmployees(days)).toEqual([
      { extNr: "ROEPER", displayName: "Christian Roeper" },
      { extNr: "SCHILZ", displayName: "Stephan Schilz" },
    ]);
  });

  it("filters by month and employee, empty filter matches all", () => {
    expect(filterApprovals(days, "", "")).toHaveLength(3);
    expect(filterApprovals(days, "2026-03", "")).toHaveLength(1);
    expect(filterApprovals(days, "", "ROEPER")).toHaveLength(2);
    expect(filterApprovals(days, "2026-04", "SCHILZ")).toHaveLength(1);
    expect(filterApprovals(days, "2026-03", "SCHILZ")).toHaveLength(0);
  });
});
