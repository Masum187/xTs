import { describe, expect, it } from "vitest";

import {
  authIdentifier,
  claimsFromErrorPayload,
  entraConfigured,
  hasRole,
  resolveAuthority,
  stateFromStatus,
} from "./auth.logic";
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

  it("detects a usable Entra configuration and resolves the authority", () => {
    const config = {
      tenantId: " 11111111-2222-3333-4444-555555555555 ",
      clientId: "abc",
      authority: "https://login.microsoftonline.com/<tenantId>",
      scopes: ["openid"],
      tokenKind: "id" as const,
    };
    expect(entraConfigured(config)).toBe(true);
    expect(entraConfigured({ ...config, clientId: "" })).toBe(false);
    expect(entraConfigured({ ...config, tenantId: "  " })).toBe(false);
    expect(resolveAuthority(config)).toBe(
      "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555",
    );
  });

  it("extracts Entra claims from error payloads for the not-mapped panel", () => {
    expect(
      claimsFromErrorPayload({
        oid: " 00000000-0000-4000-8000-000000000099 ",
        upn: " neu.extern@qualitytimes.de ",
      }),
    ).toEqual({
      oid: "00000000-0000-4000-8000-000000000099",
      upn: "neu.extern@qualitytimes.de",
    });
    expect(claimsFromErrorPayload({ oid: 123, upn: null })).toEqual({
      oid: "",
      upn: "",
    });
  });

  it("shows the real Entra identifier instead of the mock persona", () => {
    expect(
      authIdentifier(true, "stephan.schilz@qualitytimes.de", "Konto", {
        oid: "",
        upn: "neu.extern@qualitytimes.de",
      }),
    ).toBe("neu.extern@qualitytimes.de");
    expect(
      authIdentifier(true, "stephan.schilz@qualitytimes.de", "Konto", {
        oid: "",
        upn: "",
      }),
    ).toBe("Konto");
    expect(
      authIdentifier(false, "stephan.schilz@qualitytimes.de", "Konto", {
        oid: "",
        upn: "neu.extern@qualitytimes.de",
      }),
    ).toBe("stephan.schilz@qualitytimes.de");
  });

  it("checks roles against the profile", () => {
    expect(hasRole(profile, "approver")).toBe(true);
    expect(hasRole(profile, "user")).toBe(true);
    expect(hasRole({ ...profile, roles: ["user"] }, "approver")).toBe(false);
    expect(hasRole(null, "user")).toBe(false);
  });
});
