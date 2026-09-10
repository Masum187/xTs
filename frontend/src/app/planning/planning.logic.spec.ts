import { describe, expect, it } from "vitest";

import {
  formatMonthLabel,
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
