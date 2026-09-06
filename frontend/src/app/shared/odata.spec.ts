import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, parseErrorBody } from "./api-error";
import { D } from "./decode";
import {
  ODataHttp,
  buildQuery,
  unwrapCollection,
  unwrapEntity,
} from "./odata-http";

describe("odata shapes", () => {
  it("unwraps mock/V4 and V2 collections including paging hints", () => {
    expect(unwrapCollection({ value: [1, 2] })).toEqual({
      items: [1, 2],
      nextLink: null,
      count: null,
    });
    expect(
      unwrapCollection({
        d: {
          results: [{ a: 1 }],
          __next: "MyTimesheets?$skip=2&$top=2",
          __count: "7",
        },
      }),
    ).toEqual({
      items: [{ a: 1 }],
      nextLink: "MyTimesheets?$skip=2&$top=2",
      count: 7,
    });
    expect(() => unwrapCollection({ d: {} })).toThrow("OData-Liste");
  });

  it("unwraps V2 entities and leaves plain objects untouched", () => {
    expect(unwrapEntity({ d: { extNr: "SCHILZ" } })).toEqual({
      extNr: "SCHILZ",
    });
    expect(unwrapEntity({ extNr: "SCHILZ" })).toEqual({ extNr: "SCHILZ" });
  });

  it("builds query strings without empty values", () => {
    expect(buildQuery({ start: "2026-04", team: "", extNr: undefined })).toBe(
      "?start=2026-04",
    );
    expect(buildQuery({})).toBe("");
  });
});

describe("error bodies", () => {
  it("reads the mock form", () => {
    expect(
      parseErrorBody(
        {
          error: "TEAM_ASSIGNMENT_OVERLAP",
          message: "Ueberlappt",
          conflictId: "TA-1",
        },
        409,
      ),
    ).toEqual({
      code: "TEAM_ASSIGNMENT_OVERLAP",
      message: "Ueberlappt",
      details: { conflictId: "TA-1" },
    });
  });

  it("reads the SAP OData V2 form", () => {
    const info = parseErrorBody(
      {
        error: {
          code: "INVALID_EMPLOYEE",
          message: { lang: "de", value: "Pflichtfelder fehlen" },
          innererror: { fields: ["EXTNR", "NACHNAME"] },
        },
      },
      400,
    );
    expect(info).toEqual({
      code: "INVALID_EMPLOYEE",
      message: "Pflichtfelder fehlen",
      details: { fields: ["EXTNR", "NACHNAME"] },
    });
    const error = new ApiError(400, info.code, info.message, info.details);
    expect(error.fields).toEqual(["EXTNR", "NACHNAME"]);
    expect(error.conflictId).toBeUndefined();
  });

  it("falls back to an HTTP message", () => {
    expect(parseErrorBody("<html>", 502).message).toBe(
      "Die Anfrage ist fehlgeschlagen (HTTP 502).",
    );
  });
});

describe("ODataClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client(): ODataHttp {
    return new ODataHttp("http://127.0.0.1:4010/odata", () => ({
      "x-mock-oauth-upn": "u",
    }));
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("follows V2 __next links and decodes every page", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("$skip=1")
        ? jsonResponse({ d: { results: [{ hours: "2.000" }] } })
        : jsonResponse({
            d: { results: [{ hours: "1.500" }], __next: "Rows?$skip=1" },
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const rows = await client().list(
      "Rows",
      D.object<{ hours: number }>({ hours: D.number }),
    );
    expect(rows).toEqual([{ hours: 1.5 }, { hours: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://127.0.0.1:4010/odata/Rows?$skip=1",
    );
    const headers = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["accept"]).toBe("application/json");
    expect(headers["x-mock-oauth-upn"]).toBe("u");
  });

  it("stops following pages when the identity changes in between", async () => {
    let upn = "a";
    const fetchMock = vi.fn(async () => {
      upn = "b";
      return jsonResponse({ d: { results: [{}], __next: "Rows?$skip=1" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const http = new ODataHttp("http://127.0.0.1:4010/odata", () => ({
      "x-mock-oauth-upn": upn,
    }));
    await expect(http.list("Rows", D.unknown)).rejects.toMatchObject({
      code: "IDENTITY_CHANGED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns decode failures into a readable ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ value: [{ hours: "viele" }] })),
    );
    await expect(
      client().list("Rows", D.object<{ hours: number }>({ hours: D.number })),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: expect.stringContaining("[0].hours: erwartet Zahl"),
    });
  });

  it("raises ApiError with code and message for V2 error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "TIMESHEET_LOCKED",
              message: { lang: "de", value: "Gesperrt (Status F)" },
              innererror: { status: "F" },
            },
          },
          409,
        ),
      ),
    );
    await expect(
      client().post("TimesheetDays", {}, D.unknown),
    ).rejects.toMatchObject({
      status: 409,
      code: "TIMESHEET_LOCKED",
      message: "Gesperrt (Status F)",
      details: { status: "F" },
    });
  });
});
