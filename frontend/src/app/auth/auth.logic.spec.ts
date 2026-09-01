import { describe, expect, it } from "vitest";

import { hasRole, stateFromStatus } from "./auth.logic";
import type { AuthProfile } from "./auth.models";

const profile: AuthProfile = {
  extNr: "ROEPER",
  displayName: "Christian Roeper",
  company: "QualityTimes",
  roles: ["user", "approver"],
};

describe("auth logic", () => {
  it("maps HTTP status to auth states", () => {
    expect(stateFromStatus(200)).toBe("ready");
    expect(stateFromStatus(404)).toBe("not-mapped");
    expect(stateFromStatus(403)).toBe("inactive");
    expect(stateFromStatus(500)).toBe("error");
    expect(stateFromStatus(401)).toBe("error");
  });

  it("checks roles against the profile", () => {
    expect(hasRole(profile, "approver")).toBe(true);
    expect(hasRole(profile, "user")).toBe(true);
    expect(hasRole({ ...profile, roles: ["user"] }, "approver")).toBe(false);
    expect(hasRole(null, "user")).toBe(false);
  });
});
