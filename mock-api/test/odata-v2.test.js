import assert from "node:assert/strict";
import test from "node:test";

import { toODataV2, toV2Value } from "../src/odata-v2.js";
import { json } from "../src/routes.js";

const request = (url) => ({ url, headers: { host: "127.0.0.1:4010" } });

test("V2 shape converts decimals, dates and times by field class", () => {
  assert.deepEqual(
    toV2Value("", {
      hours: 7.5,
      breakMinutes: 30,
      date: "2026-04-13",
      month: "2026-04",
      startTime: "08:30",
      approvedAt: "2026-04-14T10:15:00.000Z",
      lines: [{ hours: 2, description: "x" }],
      from: "E",
    }),
    {
      hours: "7.500",
      breakMinutes: 30,
      date: "/Date(1776038400000)/",
      month: "2026-04",
      startTime: "PT08H30M00S",
      approvedAt: "/Date(1776161700000)/",
      lines: [{ hours: "2.000", description: "x" }],
      from: "E",
    },
  );
});

test("V2 shape wraps collections with paging, count and metadata", () => {
  const items = [1, 2, 3, 4, 5].map((n) => ({ id: `T${n}`, hours: n }));
  const result = json({ value: items });
  const page = JSON.parse(
    toODataV2(
      result,
      request("/odata/Rows?date=2026-04-13&$top=3&$inlinecount=allpages"),
    ).body,
  );
  assert.equal(page.d.results.length, 3);
  assert.equal(page.d.results[0].__metadata.type, "xTS.Rows");
  assert.equal(page.d.results[0].hours, "1.000");
  assert.equal(page.d.__count, "5");
  assert.equal(page.d.__next, undefined);

  const server = JSON.parse(
    toODataV2(result, request("/odata/Rows?date=2026-04-13"), { pageSize: 2 })
      .body,
  );
  assert.deepEqual(
    server.d.results.map((item) => item.id),
    ["T1", "T2"],
  );
  assert.equal(
    server.d.__next,
    "http://127.0.0.1:4010/odata/Rows?date=2026-04-13&%24skip=2",
  );
  const last = JSON.parse(
    toODataV2(result, request("/odata/Rows?$skip=4"), { pageSize: 2 }).body,
  );
  assert.deepEqual(
    last.d.results.map((item) => item.id),
    ["T5"],
  );
  assert.equal(last.d.__next, undefined);
});

test("V2 shape wraps entities and errors, leaves other paths alone", () => {
  const entity = JSON.parse(
    toODataV2(
      json({ extNr: "SCHILZ", workHours: 8 }, 201),
      request("/odata/TimesheetDays"),
    ).body,
  );
  assert.deepEqual(entity, {
    d: {
      __metadata: { type: "xTS.TimesheetDays" },
      extNr: "SCHILZ",
      workHours: "8.000",
    },
  });

  const error = JSON.parse(
    toODataV2(
      json({ error: "TEAM_ASSIGNMENT_OVERLAP", conflictId: "TA-1" }, 409),
      request("/odata/TeamAssignments"),
    ).body,
  );
  assert.equal(error.error.code, "TEAM_ASSIGNMENT_OVERLAP");
  assert.equal(error.error.message.lang, "de");
  assert.match(error.error.message.value, /TA-1/);
  assert.deepEqual(error.error.innererror, { conflictId: "TA-1" });

  const health = json({ status: "ok" });
  assert.equal(toODataV2(health, request("/health")).body, health.body);
});
