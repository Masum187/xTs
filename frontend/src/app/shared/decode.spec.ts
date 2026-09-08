import { describe, expect, it } from "vitest";

import { D, DecodeError, decode } from "./decode";

describe("decode", () => {
  it("accepts numbers as JSON numbers and as Edm.Decimal strings", () => {
    expect(decode(D.number, 8.5)).toBe(8.5);
    expect(decode(D.number, "8.500")).toBe(8.5);
    expect(decode(D.number, "-0.25")).toBe(-0.25);
    expect(() => decode(D.number, "abc")).toThrow(DecodeError);
    expect(() => decode(D.number, "")).toThrow(DecodeError);
    expect(() => decode(D.integer, "8.5")).toThrow(DecodeError);
    expect(decode(D.integer, "30")).toBe(30);
  });

  it("normalises dates and timestamps from ISO and /Date(ms)/", () => {
    const ms = Date.UTC(2026, 3, 13);
    expect(decode(D.date, "2026-04-13")).toBe("2026-04-13");
    expect(decode(D.date, "2026-04-13T00:00:00")).toBe("2026-04-13");
    expect(decode(D.date, `/Date(${ms})/`)).toBe("2026-04-13");
    expect(decode(D.date, `/Date(${ms}+0000)/`)).toBe("2026-04-13");
    expect(decode(D.dateTime, `/Date(${ms})/`)).toBe(
      "2026-04-13T00:00:00.000Z",
    );
    expect(decode(D.dateTime, "2026-04-13T10:15:00.000Z")).toBe(
      "2026-04-13T10:15:00.000Z",
    );
    expect(() => decode(D.date, "13.04.2026")).toThrow(DecodeError);
  });

  it("normalises times from HH:MM, HH:MM:SS and Edm.Time", () => {
    expect(decode(D.time, "08:30")).toBe("08:30");
    expect(decode(D.time, "08:30:00")).toBe("08:30");
    expect(decode(D.time, "PT08H30M00S")).toBe("08:30");
    expect(decode(D.time, "PT17H")).toBe("17:00");
    expect(() => decode(D.time, "8:30 Uhr")).toThrow(DecodeError);
  });

  it("decodes objects by shape, drops unknown fields and names the path", () => {
    const line = D.object<{ coIdent: string; hours: number; note?: string }>({
      coIdent: D.string,
      hours: D.number,
      note: D.optional(D.string),
    });
    const day = D.object<{ date: string; lines: { coIdent: string }[] }>({
      date: D.date,
      lines: D.array(line),
    });
    expect(
      decode(day, {
        date: "/Date(1776038400000)/",
        __metadata: { type: "xTS.TimesheetDay" },
        lines: [{ coIdent: "6000", hours: "4.000", note: null, extra: 1 }],
      }),
    ).toEqual({ date: "2026-04-13", lines: [{ coIdent: "6000", hours: 4 }] });
    expect(() =>
      decode(day, { date: "2026-04-13", lines: [{ coIdent: 1, hours: 4 }] }),
    ).toThrow("lines[0].coIdent: erwartet Text, erhalten 1");
  });

  it("supports literals, nullable, fallback, text and records", () => {
    expect(decode(D.literal("E", "F"), "F")).toBe("F");
    expect(() => decode(D.literal("E", "F"), "G")).toThrow("E | F");
    expect(decode(D.nullable(D.string), null)).toBeNull();
    expect(decode(D.fallback(D.boolean, false), undefined)).toBe(false);
    expect(decode(D.text, null)).toBe("");
    expect(decode(D.record(D.number), { a: "1.5", __count: "9" })).toEqual({
      a: 1.5,
    });
  });
});
