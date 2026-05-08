import { describe, expect, it } from "vitest";

import { canSubmitTimesheet, sumLineHours } from "./timesheet.logic";
import { TimesheetDay } from "./timesheet.models";

const baseDay: TimesheetDay = {
  extNr: "SCHILZ",
  date: "2026-04-13",
  startTime: "08:30",
  endTime: "17:30",
  breakMinutes: 30,
  location: "remote",
  status: "E",
  lines: [
    {
      coIdent: "700000000004",
      description: "Daily Projektabstimmung",
      hours: 2,
    },
  ],
};

describe("timesheet logic", () => {
  it("sums line hours", () => {
    expect(
      sumLineHours([
        ...baseDay.lines,
        { coIdent: "600000000001", description: "Konzept", hours: 1.5 },
      ]),
    ).toBe(3.5);
  });

  it("allows submit only for editable entries with hours", () => {
    expect(canSubmitTimesheet(baseDay)).toBe(true);
    expect(canSubmitTimesheet({ ...baseDay, status: "F" })).toBe(false);
    expect(canSubmitTimesheet({ ...baseDay, lines: [] })).toBe(false);
  });
});
