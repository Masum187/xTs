import { describe, expect, it } from "vitest";

import {
  canEditTimesheet,
  canSubmitTimesheet,
  createEmptyDay,
  isCostObjectBookable,
  shiftDate,
  sumLineHours,
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
  id: "000001",
  coIdent: "700000000004",
  description: "SAP-Implementierung",
  validFrom: "2026-02-01",
  validTo: "2026-04-30",
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

  it("creates an empty draft day", () => {
    const day = createEmptyDay("SCHILZ", "2026-04-14");
    expect(day.status).toBe("E");
    expect(day.lines).toEqual([]);
    expect(day.extNr).toBe("SCHILZ");
    expect(day.date).toBe("2026-04-14");
  });
});
