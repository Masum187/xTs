import { describe, expect, it } from "vitest";

import type { ApprovalDay } from "../timesheet/timesheet.models";
import {
  filterApprovals,
  keepSelection,
  monthOf,
  nextSelectionAfter,
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

describe("selection (XTS-151)", () => {
  const keys = ["A|2026-04-01", "B|2026-04-02", "C|2026-04-03"];

  it("keeps a selection that is still listed and falls back to the first", () => {
    expect(keepSelection(keys, "B|2026-04-02")).toBe("B|2026-04-02");
    expect(keepSelection(keys, "X|2026-01-01")).toBe("A|2026-04-01");
    expect(keepSelection(keys, "")).toBe("A|2026-04-01");
    expect(keepSelection([], "B|2026-04-02")).toBe("");
  });

  it("moves to the next entry, to the previous one at the end, to none when empty", () => {
    expect(nextSelectionAfter(keys, "A|2026-04-01")).toBe("B|2026-04-02");
    expect(nextSelectionAfter(keys, "B|2026-04-02")).toBe("C|2026-04-03");
    expect(nextSelectionAfter(keys, "C|2026-04-03")).toBe("B|2026-04-02");
    expect(nextSelectionAfter(["A|2026-04-01"], "A|2026-04-01")).toBe("");
    expect(nextSelectionAfter(keys, "unknown")).toBe("A|2026-04-01");
  });
});
