import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { BusyState, LoadState } from "./async-state";

describe("async state", () => {
  it("tracks loading, ready and error with a readable message", async () => {
    const state = new LoadState();
    expect(state.value().status).toBe("idle");
    const pending = state.track(async () => "ok", "Fehler");
    expect(state.value().status).toBe("loading");
    expect(await pending).toBe("ok");
    expect(state.ready()).toBe(true);

    await state.track(async () => {
      throw new ApiError(500, "INTERNAL", "Backend kaputt");
    }, "Laden fehlgeschlagen.");
    expect(state.value()).toEqual({ status: "error", error: "Backend kaputt" });

    await state.track(async () => {
      throw new Error("boom");
    }, "Laden fehlgeschlagen.");
    expect(state.value().error).toBe("Laden fehlgeschlagen.");
  });

  it("ignores results of superseded loads", async () => {
    const state = new LoadState();
    let releaseFirst: () => void = () => undefined;
    const first = state.track(
      () => new Promise<void>((resolve) => (releaseFirst = resolve)),
      "x",
    );
    await state.track(async () => {
      throw new Error("second failed");
    }, "Zweiter Fehler");
    releaseFirst();
    await first;
    expect(state.value().status).toBe("error");
  });

  it("prevents overlapping actions", async () => {
    const busy = new BusyState();
    let runs = 0;
    let release: () => void = () => undefined;
    const first = busy.guard(
      () =>
        new Promise<void>((resolve) => {
          runs += 1;
          release = resolve;
        }),
    );
    expect(busy.active()).toBe(true);
    expect(await busy.guard(async () => void (runs += 1))).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(runs).toBe(1);
    expect(busy.active()).toBe(false);
  });
});
