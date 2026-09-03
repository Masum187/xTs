import { describe, expect, it } from "vitest";

import {
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  isCostObjectBookable,
  shiftDate,
  sumLineHours,
  validateTimesheetDay,
} from "./timesheet.logic";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

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

const baseCostObject: EnabledCostObject = {
  extNr: "SCHILZ",
  coIdent: "700000000004",
  description: "SAP-Implementierung",
  validFrom: "2026-02-01",
  validTo: "2026-04-30",
  orderedHours: 320,
  bookedHours: 80,
  remainingHours: 240,
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

  it("allows editing only for draft and rejected entries", () => {
    expect(canEditTimesheet(baseDay)).toBe(true);
    expect(canEditTimesheet({ ...baseDay, status: "A" })).toBe(true);
    expect(canEditTimesheet({ ...baseDay, status: "F" })).toBe(false);
    expect(canEditTimesheet({ ...baseDay, status: "G" })).toBe(false);
  });

  it("allows submit only for editable entries with hours", () => {
    expect(canSubmitTimesheet(baseDay)).toBe(true);
    expect(canSubmitTimesheet({ ...baseDay, status: "A" })).toBe(true);
    expect(canSubmitTimesheet({ ...baseDay, status: "F" })).toBe(false);
    expect(canSubmitTimesheet({ ...baseDay, lines: [] })).toBe(false);
  });

  it("marks cost objects bookable only inside validity with remaining hours", () => {
    expect(isCostObjectBookable(baseCostObject, "2026-04-13")).toBe(true);
    expect(isCostObjectBookable(baseCostObject, "2026-02-01")).toBe(true);
    expect(isCostObjectBookable(baseCostObject, "2026-05-01")).toBe(false);
    expect(isCostObjectBookable(baseCostObject, "2026-01-31")).toBe(false);
    expect(
      isCostObjectBookable(
        { ...baseCostObject, remainingHours: 0 },
        "2026-04-13",
      ),
    ).toBe(false);
  });

  it("shifts dates across month boundaries", () => {
    expect(shiftDate("2026-04-13", 1)).toBe("2026-04-14");
    expect(shiftDate("2026-04-01", -1)).toBe("2026-03-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("validates hours, times, break and descriptions like the server", () => {
    const codes = (day: TimesheetDay, mode: "draft" | "submit") =>
      validateTimesheetDay(day, mode).map((problem) => problem.code);
    const line = (hours: number, description = "x") => ({
      coIdent: "700000000004",
      description,
      hours,
    });
    expect(codes(baseDay, "submit")).toEqual([]);
    expect(codes({ ...baseDay, lines: [line(-5)] }, "draft")).toEqual([
      "HOURS_RANGE",
    ]);
    expect(codes({ ...baseDay, lines: [line(25)] }, "draft")).toEqual([
      "HOURS_RANGE",
    ]);
    expect(codes({ ...baseDay, lines: [line(1.3333)] }, "draft")).toEqual([
      "HOURS_STEP",
    ]);
    expect(codes({ ...baseDay, lines: [line(Number.NaN)] }, "draft")).toEqual([
      "HOURS_INVALID",
    ]);
    expect(codes({ ...baseDay, lines: [line(0)] }, "draft")).toEqual([]);
    expect(codes({ ...baseDay, lines: [line(0)] }, "submit")).toEqual([
      "HOURS_RANGE",
    ]);
    expect(codes({ ...baseDay, lines: [line(1, "")] }, "draft")).toEqual([]);
    expect(codes({ ...baseDay, lines: [line(1, "  ")] }, "submit")).toEqual([
      "DESCRIPTION_REQUIRED",
    ]);
    expect(
      codes({ ...baseDay, lines: [line(12), line(12.25)] }, "draft"),
    ).toEqual(["DAY_HOURS_EXCEEDED"]);
    expect(codes({ ...baseDay, startTime: "abc" }, "draft")).toEqual([
      "TIME_FORMAT",
    ]);
    expect(
      codes({ ...baseDay, startTime: "17:00", endTime: "08:00" }, "draft"),
    ).toEqual(["TIME_RANGE"]);
    expect(codes({ ...baseDay, breakMinutes: -30 }, "draft")).toEqual([
      "BREAK_INVALID",
    ]);
    expect(codes({ ...baseDay, breakMinutes: 600 }, "draft")).toEqual([
      "BREAK_TOO_LONG",
    ]);
    expect(canSubmitTimesheet({ ...baseDay, lines: [line(1.3333)] })).toBe(
      false,
    );
  });

  it("creates an empty draft day", () => {
    const day = createEmptyDay("SCHILZ", "2026-04-14");
    expect(day.status).toBe("E");
    expect(day.lines).toEqual([]);
    expect(day.extNr).toBe("SCHILZ");
    expect(day.date).toBe("2026-04-14");
  });
});
