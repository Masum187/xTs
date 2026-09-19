import { describe, expect, it } from "vitest";

import { TimesheetDayStore } from "./timesheet-day.store";
import type { TimesheetDayGateway } from "./timesheet-day.store";
import { createEmptyDay } from "./timesheet.logic";
import type { DatePeriod } from "./timesheet.logic";
import type { EnabledCostObject, TimesheetDay } from "./timesheet.models";

type Deferred<T> = { resolve: (value: T) => void; promise: Promise<T> };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { resolve, promise };
}

function costObject(coIdent: string): EnabledCostObject {
  return {
    extNr: "SCHILZ",
    coIdent,
    description: coIdent,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    orderedHours: 100,
    bookedHours: 0,
    remainingHours: 100,
  };
}

function day(extNr: string, date: string): TimesheetDay {
  return { ...createEmptyDay(extNr, date), startTime: "08:00" };
}

/** Gateway mit steuerbaren Antworten je Aufruf (Reihenfolge der Aufrufe). */
function gateway(options: {
  timesheets?: (period: DatePeriod) => Promise<TimesheetDay[]>;
  costObjects?: () => Promise<EnabledCostObject[]>;
  save?: (day: TimesheetDay) => Promise<TimesheetDay>;
}): TimesheetDayGateway & { periods: DatePeriod[] } {
  const periods: DatePeriod[] = [];
  return {
    periods,
    getEnabledCostObjects: options.costObjects ?? (async () => []),
    getMyTimesheets: (period) => {
      periods.push(period);
      return options.timesheets?.(period) ?? Promise.resolve([]);
    },
    saveTimesheet:
      options.save ?? (async (value) => ({ ...value, status: "E" as const })),
  };
}

describe("TimesheetDayStore", () => {
  it("serves saved days of the loaded window and empty days elsewhere", async () => {
    const store = new TimesheetDayStore(
      gateway({ timesheets: async () => [day("SCHILZ", "2026-04-13")] }),
    );
    expect(await store.loadAround("SCHILZ", "2026-04-13")).toBe(true);
    expect(store.loader.ready()).toBe(true);
    expect(store.savedDay("2026-04-13")?.startTime).toBe("08:00");
    expect(store.savedDay("2026-04-14")).toBeUndefined();
    expect(store.covers("2026-03-01")).toBe(true);
    expect(store.covers("2026-05-31")).toBe(true);
    expect(store.covers("2026-06-01")).toBe(false);
  });

  it("changes the window for a date outside it and remembers the requested date", async () => {
    const api = gateway({});
    const store = new TimesheetDayStore(api);
    await store.loadAround("SCHILZ", "2026-04-13");
    await store.loadAround("SCHILZ", "2026-08-03");
    expect(api.periods).toEqual([
      { from: "2026-03-01", to: "2026-05-31" },
      { from: "2026-07-01", to: "2026-09-30" },
    ]);
    expect(store.requestedDate()).toBe("2026-08-03");
    expect(store.covers("2026-04-13")).toBe(false);
  });

  it("retries the last requested window after a failed window change", async () => {
    let fail = true;
    const api = gateway({
      timesheets: async (period) => {
        if (fail && period.from === "2026-07-01") throw new Error("down");
        return [];
      },
    });
    const store = new TimesheetDayStore(api);
    await store.loadAround("SCHILZ", "2026-04-13");
    expect(await store.loadAround("SCHILZ", "2026-08-03")).toBe(false);
    expect(store.loader.value().status).toBe("error");
    expect(store.requestedDate()).toBe("2026-08-03");
    fail = false;
    expect(await store.retry("SCHILZ")).toBe(true);
    expect(api.periods.at(-1)).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(store.covers("2026-08-03")).toBe(true);
  });

  it("drops an older response that finishes after a newer load", async () => {
    const first = deferred<TimesheetDay[]>();
    let call = 0;
    const store = new TimesheetDayStore(
      gateway({
        timesheets: () =>
          ++call === 1
            ? first.promise
            : Promise.resolve([day("SCHILZ", "2026-08-03")]),
      }),
    );
    const older = store.loadAround("SCHILZ", "2026-04-13");
    const newer = store.loadAround("SCHILZ", "2026-08-03");
    expect(await newer).toBe(true);
    first.resolve([day("SCHILZ", "2026-04-13")]);
    expect(await older).toBe(false);
    expect(store.savedDay("2026-04-13")).toBeUndefined();
    expect(store.savedDay("2026-08-03")).toBeDefined();
    expect(store.covers("2026-04-13")).toBe(false);
  });

  it("clears everything immediately when loading for another identity", async () => {
    const pending = deferred<TimesheetDay[]>();
    let call = 0;
    const store = new TimesheetDayStore(
      gateway({
        timesheets: () =>
          ++call === 1
            ? Promise.resolve([day("SCHILZ", "2026-04-13")])
            : pending.promise,
        costObjects: async () => [costObject("700000000001")],
      }),
    );
    await store.loadAround("SCHILZ", "2026-04-13");
    expect(store.savedDay("2026-04-13")).toBeDefined();
    expect(store.costObjects()).toHaveLength(1);

    const load = store.loadAround("WEBER", "2026-04-13");
    // Sofort, noch vor der Antwort: keine Tage, Freischaltungen und kein
    // Fenster der alten Identitaet.
    expect(store.savedDay("2026-04-13")).toBeUndefined();
    expect(store.costObjects()).toEqual([]);
    expect(store.covers("2026-04-13")).toBe(false);
    pending.resolve([day("WEBER", "2026-04-13")]);
    await load;
    expect(store.savedDay("2026-04-13")?.extNr).toBe("WEBER");
  });

  it("never applies a late response of the previous identity", async () => {
    const stale = deferred<TimesheetDay[]>();
    let call = 0;
    const store = new TimesheetDayStore(
      gateway({
        timesheets: () =>
          ++call === 1
            ? stale.promise
            : Promise.resolve([day("WEBER", "2026-04-13")]),
      }),
    );
    const old = store.loadAround("SCHILZ", "2026-04-13");
    await store.loadAround("WEBER", "2026-04-13");
    stale.resolve([day("SCHILZ", "2026-04-13"), day("SCHILZ", "2026-04-14")]);
    expect(await old).toBe(false);
    expect(store.savedDay("2026-04-13")?.extNr).toBe("WEBER");
    expect(store.savedDay("2026-04-14")).toBeUndefined();
  });

  it("caches the saved day and refreshes the quotas after persisting", async () => {
    let remaining = 100;
    const store = new TimesheetDayStore(
      gateway({
        costObjects: async () => [
          { ...costObject("700000000001"), remainingHours: remaining },
        ],
        save: async (value) => {
          remaining = 92;
          return { ...value, status: "E" as const, workHours: 8 };
        },
      }),
    );
    await store.loadAround("SCHILZ", "2026-04-13");
    const saved = await store.persist(day("SCHILZ", "2026-04-14"));
    expect(saved.workHours).toBe(8);
    expect(store.savedDay("2026-04-14")).toEqual(saved);
    expect(store.costObjects()[0].remainingHours).toBe(92);
  });

  it("keeps the cache untouched when saving fails", async () => {
    const store = new TimesheetDayStore(
      gateway({
        timesheets: async () => [day("SCHILZ", "2026-04-13")],
        save: async () => {
          throw new Error("500");
        },
      }),
    );
    await store.loadAround("SCHILZ", "2026-04-13");
    const changed = { ...day("SCHILZ", "2026-04-13"), startTime: "09:00" };
    await expect(store.persist(changed)).rejects.toThrow("500");
    expect(store.savedDay("2026-04-13")?.startTime).toBe("08:00");
  });
});
