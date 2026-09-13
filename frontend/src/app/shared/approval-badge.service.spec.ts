import { describe, expect, it } from "vitest";

import { ApprovalBadgeService } from "./approval-badge.service";
import type { AuthProfile } from "../auth/auth.models";

const approver: AuthProfile = {
  extNr: "ROEPER",
  displayName: "Christian Roeper",
  company: "QT",
  roles: ["user", "approver"],
  today: "2026-05-05",
  timesheetWindow: { from: "2026-04-01", to: "2026-05-05" },
};

function serviceWith(loader: () => Promise<unknown[]>): ApprovalBadgeService {
  const service = Object.create(ApprovalBadgeService.prototype);
  Object.assign(service, {
    approvals: { getApprovalTimesheets: loader },
    run: 0,
  });
  return Object.assign(service, {
    count: (ApprovalBadgeService as unknown as { new (): ApprovalBadgeService })
      .prototype.count,
  });
}

describe("ApprovalBadgeService", () => {
  it("ignores older responses when refreshes overlap for the same identity", async () => {
    const { signal } = await import("@angular/core");
    let releaseFirst: (value: unknown[]) => void = () => undefined;
    const first = new Promise<unknown[]>((resolve) => (releaseFirst = resolve));
    const calls: number[] = [];
    const service = serviceWith(async () => {
      calls.push(calls.length);
      return calls.length === 1 ? first : [{}, {}];
    });
    service.count = signal<number | null>(null);
    const older = service.refresh(approver);
    const newer = service.refresh(approver);
    await newer;
    expect(service.count()).toBe(2);
    releaseFirst([{}, {}, {}, {}, {}]);
    await older;
    expect(service.count()).toBe(2);
  });

  it("clears immediately and drops in-flight results on identity change", async () => {
    const { signal } = await import("@angular/core");
    let release: (value: unknown[]) => void = () => undefined;
    const pending = new Promise<unknown[]>((resolve) => (release = resolve));
    const service = serviceWith(async () => pending);
    service.count = signal<number | null>(null);
    const load = service.refresh(approver);
    service.clear();
    release([{}, {}, {}]);
    await load;
    expect(service.count()).toBeNull();
  });

  it("shows no badge without approver role and on load errors", async () => {
    const { signal } = await import("@angular/core");
    const service = serviceWith(async () => {
      throw new Error("kaputt");
    });
    service.count = signal<number | null>(3);
    await service.refresh({ ...approver, roles: ["user"] });
    expect(service.count()).toBeNull();
    service.count.set(3);
    await service.refresh(approver);
    expect(service.count()).toBeNull();
  });
});
