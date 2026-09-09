import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service";

type Deferred = {
  resolve: (response: Response) => void;
  promise: Promise<Response>;
};

function deferred(): Deferred {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { resolve, promise };
}

function profileResponse(extNr: string, displayName: string): Response {
  return new Response(
    JSON.stringify({
      extNr,
      displayName,
      company: "QT",
      roles: ["user"],
      today: "2026-05-05",
      timesheetWindow: { from: "2026-04-01", to: "2026-05-05" },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("AuthService profile loading", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies only the newest profile load when persona switches overlap", async () => {
    const calls: Deferred[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        const call = deferred();
        calls.push(call);
        return call.promise;
      }),
    );
    const auth = new AuthService();

    const first = auth.loadProfile();
    expect(auth.state()).toBe("loading");
    const second = auth.switchPersona("christian.roeper@qualitytimes.de");
    expect(calls).toHaveLength(2);

    // Der neuere Load antwortet zuerst ...
    calls[1].resolve(profileResponse("ROEPER", "Christian Roeper"));
    await second;
    expect(auth.state()).toBe("ready");
    expect(auth.profile()?.extNr).toBe("ROEPER");

    // ... der alte kommt spaet und darf nichts mehr ueberschreiben.
    calls[0].resolve(profileResponse("SCHILZ", "Stephan Schilz"));
    expect(await first).toBe("ready");
    expect(auth.profile()?.extNr).toBe("ROEPER");
    expect(auth.state()).toBe("ready");
    expect(auth.personaUpn()).toBe("christian.roeper@qualitytimes.de");
  });

  it("keeps the newest state when an old load fails late", async () => {
    const calls: Deferred[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        const call = deferred();
        calls.push(call);
        return call.promise;
      }),
    );
    const auth = new AuthService();
    const first = auth.loadProfile();
    const second = auth.switchPersona("christian.roeper@qualitytimes.de");
    calls[1].resolve(profileResponse("ROEPER", "Christian Roeper"));
    await second;
    calls[0].resolve(new Response("{}", { status: 403 }));
    await first;
    expect(auth.state()).toBe("ready");
    expect(auth.profile()?.extNr).toBe("ROEPER");
  });
});
