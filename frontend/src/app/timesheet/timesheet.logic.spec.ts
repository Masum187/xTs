import { describe, expect, it } from "vitest";

import {
  formatDateDe,
  isSameTimesheet,
  isWeekend,
  isWithinPeriod,
  periodAround,
  todayIso,
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  dayVariance,
  isCostObjectBookable,
  shiftDate,
  quotaProblems,
  sumLineHours,
  validateTimesheetDay,
  workHoursOf,
} from "./timesheet.logic";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

// 08:30–11:00 mit 30 Min. Pause = 2 Std. Arbeitszeit, passend zur Position.
const baseDay: TimesheetDay = {
  extNr: "SCHILZ",
  date: "2026-04-13",
  startTime: "08:30",
  endTime: "11:00",
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

  it("sums hours in whole minutes without floating point drift", () => {
    const line = (hours: number) => ({
      coIdent: "700000000004",
      description: "x",
      hours,
    });
    expect(sumLineHours([line(0.1), line(0.2)])).toBe(0.3);
    expect(sumLineHours(Array.from({ length: 9 }, () => line(0.1)))).toBe(0.9);
    expect(sumLineHours([line(1.1), line(1.1), line(1.1)])).toBe(3.3);
    expect(sumLineHours([line(7.5), line(0.25), line(0.25)])).toBe(8);
    expect(
      quotaProblems({ ...baseDay, lines: [line(0.1), line(0.2)] }, undefined, [
        { ...baseCostObject, remainingHours: 0.3 },
      ]),
    ).toEqual([]);
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

  it("flags bookings beyond the open quota, counting the day's saved version", () => {
    const costObjects = [{ ...baseCostObject, remainingHours: 10 }];
    const line = (hours: number) => ({
      coIdent: "700000000004",
      description: "x",
      hours,
    });
    expect(
      quotaProblems(
        { ...baseDay, lines: [line(6), line(4)] },
        undefined,
        costObjects,
      ),
    ).toEqual([]);
    expect(
      quotaProblems(
        { ...baseDay, lines: [line(6), line(4.25)] },
        undefined,
        costObjects,
      ).map((problem) => problem.code),
    ).toEqual(["QUOTA_EXCEEDED"]);
    const savedFive = { ...baseDay, lines: [line(5)] };
    expect(
      quotaProblems({ ...baseDay, lines: [line(15)] }, savedFive, costObjects),
    ).toEqual([]);
    expect(
      quotaProblems(
        { ...baseDay, lines: [line(15)] },
        { ...savedFive, status: "A" },
        costObjects,
      ).length,
    ).toBe(1);
    expect(
      quotaProblems(
        { ...baseDay, lines: [line(-5), line(0)] },
        undefined,
        costObjects,
      ),
    ).toEqual([]);
  });

  it("derives work hours and the day variance from the header", () => {
    expect(workHoursOf(baseDay)).toBe(2);
    expect(workHoursOf({ ...baseDay, endTime: "17:00" })).toBe(8);
    expect(workHoursOf({ ...baseDay, startTime: "abc" })).toBeNull();
    expect(workHoursOf({ ...baseDay, breakMinutes: 600 })).toBeNull();
    expect(dayVariance(baseDay)).toBe(0);
    expect(dayVariance({ ...baseDay, endTime: "17:00" })).toBe(-6);
    expect(
      dayVariance({
        ...baseDay,
        lines: [{ coIdent: "700000000004", description: "x", hours: 2.25 }],
      }),
    ).toBe(0.25);
  });

  it("requires a reason to submit a day whose hours differ from the work time", () => {
    const codes = (day: TimesheetDay, mode: "draft" | "submit") =>
      validateTimesheetDay(day, mode).map((problem) => problem.code);
    const differing = { ...baseDay, endTime: "17:00" };
    expect(codes(differing, "draft")).toEqual([]);
    expect(codes(differing, "submit")).toEqual(["VARIANCE_REASON_REQUIRED"]);
    expect(validateTimesheetDay(differing, "submit")[0].message).toContain(
      "(2 Std.) weicht von der Arbeitszeit (8 Std.)",
    );
    expect(codes({ ...differing, varianceReason: "  " }, "submit")).toEqual([
      "VARIANCE_REASON_REQUIRED",
    ]);
    expect(
      codes({ ...differing, varianceReason: "Reisezeit" }, "submit"),
    ).toEqual([]);
    expect(
      codes({ ...baseDay, varianceReason: "x".repeat(256) }, "draft"),
    ).toEqual(["VARIANCE_REASON_TOO_LONG"]);
    expect(canSubmitTimesheet(differing)).toBe(false);
    expect(canSubmitTimesheet({ ...differing, varianceReason: "Reise" })).toBe(
      true,
    );
  });

  it("creates an empty draft day", () => {
    const day = createEmptyDay("SCHILZ", "2026-04-14");
    expect(day.status).toBe("E");
    expect(workHoursOf(day)).toBe(8);
    expect(day.lines).toEqual([]);
    expect(day.extNr).toBe("SCHILZ");
    expect(day.date).toBe("2026-04-14");
  });

  it("builds the load window from previous to next month around a day", () => {
    expect(periodAround("2026-04-13")).toEqual({
      from: "2026-03-01",
      to: "2026-05-31",
    });
    expect(periodAround("2026-01-05")).toEqual({
      from: "2025-12-01",
      to: "2026-02-28",
    });
    expect(periodAround("2026-12-31")).toEqual({
      from: "2026-11-01",
      to: "2027-01-31",
    });
    const period = periodAround("2026-04-13");
    expect(isWithinPeriod(period, "2026-03-01")).toBe(true);
    expect(isWithinPeriod(period, "2026-05-31")).toBe(true);
    expect(isWithinPeriod(period, "2026-06-01")).toBe(false);
    expect(isWithinPeriod(null, "2026-04-13")).toBe(false);
  });

  it("formats today in local time", () => {
    expect(todayIso(new Date(2026, 8, 8, 0, 30))).toBe("2026-09-08");
    expect(todayIso(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });

  it("locks days outside the recording window and names the window", () => {
    const window = { from: "2026-04-01", to: "2026-05-05" };
    expect(canEditTimesheet(baseDay, window)).toBe(
      isWithinPeriod(window, baseDay.date),
    );
    const outside = { ...baseDay, date: "2026-03-31" };
    expect(canEditTimesheet(outside, window)).toBe(false);
    expect(canEditTimesheet(outside)).toBe(true);
    const codes = validateTimesheetDay(outside, "draft", window).map(
      (problem) => problem.code,
    );
    expect(codes).toContain("DATE_OUT_OF_RANGE");
    expect(validateTimesheetDay(outside, "draft", window)[0].message).toContain(
      "01.04.2026 bis 05.05.2026",
    );
    expect(
      validateTimesheetDay({ ...baseDay, date: "2026-05-05" }, "draft", window)
        .map((problem) => problem.code)
        .includes("DATE_OUT_OF_RANGE"),
    ).toBe(false);
  });

  it("recognises weekends and formats German dates", () => {
    expect(isWeekend("2026-04-11")).toBe(true);
    expect(isWeekend("2026-04-12")).toBe(true);
    expect(isWeekend("2026-04-13")).toBe(false);
    expect(formatDateDe("2026-04-05")).toBe("05.04.2026");
  });

  it("detects unsaved changes independent of server fields and order", () => {
    const saved: TimesheetDay = {
      ...baseDay,
      approvedBy: "ROEPER",
      weDocument: "WE-000001",
    };
    expect(isSameTimesheet(baseDay, saved)).toBe(true);
    expect(isSameTimesheet(baseDay, { ...baseDay, varianceReason: "" })).toBe(
      true,
    );
    expect(isSameTimesheet(baseDay, { ...baseDay, breakMinutes: 45 })).toBe(
      false,
    );
    expect(
      isSameTimesheet(baseDay, {
        ...baseDay,
        lines: [...baseDay.lines, { coIdent: "X", description: "", hours: 0 }],
      }),
    ).toBe(false);
  });
});
