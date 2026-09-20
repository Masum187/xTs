import { describe, expect, it } from "vitest";

import {
  cellKey,
  formatMonthLabel,
  pageCount,
  pageRange,
  pageSlice,
  parseStartMonth,
  planningHoursProblem,
} from "./planning.logic";

describe("planning logic", () => {
  it("validates plan hours like the server", () => {
    expect(planningHoursProblem("40")).toBeNull();
    expect(planningHoursProblem("8.25")).toBeNull();
    expect(planningHoursProblem("0.1")).toBeNull();
    expect(planningHoursProblem("0")).toBeNull();
    expect(planningHoursProblem("744")).toBeNull();
    expect(planningHoursProblem("1e9")).toContain("zwischen 0 und 744");
    expect(planningHoursProblem("-1")).toContain("zwischen 0 und 744");
    expect(planningHoursProblem("0.333333")).toContain("ganzen Minuten");
    expect(planningHoursProblem("abc")).toContain("Zahl");
    expect(planningHoursProblem("")).toContain("Zahl");
  });

  it("parses MM.YYYY start months", () => {
    expect(parseStartMonth("03.2026")).toBe("2026-03");
    expect(parseStartMonth(" 12.2027 ")).toBe("2027-12");
  });

  it("rejects invalid start months", () => {
    expect(parseStartMonth("2026-03")).toBeNull();
    expect(parseStartMonth("13.2026")).toBeNull();
    expect(parseStartMonth("00.2026")).toBeNull();
    expect(parseStartMonth("3.2026")).toBeNull();
    expect(parseStartMonth("")).toBeNull();
  });

  it("formats months for display", () => {
    expect(formatMonthLabel("2026-03")).toBe("03.2026");
    expect(formatMonthLabel("2027-12")).toBe("12.2027");
  });
});

describe("matrix pages (XTS-152)", () => {
  it("splits twelve months into three pages of four", () => {
    expect(pageCount(12)).toBe(3);
    expect(pageCount(0)).toBe(1);
    expect(pageRange(0, 12)).toEqual({ from: 1, to: 4, total: 12 });
    expect(pageRange(2, 12)).toEqual({ from: 9, to: 12, total: 12 });
    expect(pageRange(0, 0)).toEqual({ from: 1, to: 0, total: 0 });
    expect(pageSlice(["a", "b", "c", "d", "e"], 1)).toEqual(["e"]);
  });

  it("builds a stable cell key", () => {
    expect(cellKey("SCHILZ", "700000000004", "2026-05")).toBe(
      "SCHILZ|700000000004|2026-05",
    );
  });
});

describe("utilization (XTS-157)", () => {
  it("reads the real value above 100 % while the bar stops at 100", async () => {
    const { utilizationBarPercent, utilizationState } =
      await import("./planning.logic");
    const over = {
      plannedHours: 200,
      availableHours: 160,
      utilizationPercent: 125,
      overbooked: true,
    };
    expect(utilizationState(over)).toBe("overbooked");
    expect(utilizationBarPercent(over)).toBe(100);
    const planned = {
      plannedHours: 60,
      availableHours: 168,
      utilizationPercent: 35.7,
      overbooked: false,
    };
    expect(utilizationState(planned)).toBe("planned");
    expect(utilizationBarPercent(planned)).toBe(35.7);
  });

  it("shows no percentage and an empty bar without available hours", async () => {
    const { utilizationBarPercent, utilizationState } =
      await import("./planning.logic");
    const none = {
      plannedHours: 40,
      availableHours: 0,
      utilizationPercent: null,
      overbooked: true,
    };
    expect(utilizationState(none)).toBe("unavailable");
    expect(utilizationBarPercent(none)).toBe(0);
    expect(
      utilizationBarPercent({
        plannedHours: 0,
        availableHours: 160,
        utilizationPercent: 0,
        overbooked: false,
      }),
    ).toBe(0);
  });
});
