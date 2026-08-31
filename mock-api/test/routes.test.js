import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { resetTimesheetStore, routeRequest } from "../src/routes.js";

function request(method, url, body) {
  const stream = Readable.from(body ? [JSON.stringify(body)] : []);
  stream.method = method;
  stream.url = url;
  return stream;
}

test.beforeEach(() => {
  resetTimesheetStore();
});

test("returns employee profile", async () => {
  const response = await routeRequest(request("GET", "/odata/MyProfile"));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).extNr, "SCHILZ");
});

test("returns enabled cost objects", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects?date=2026-04-13"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 3);
  assert.equal(body.value[0].coIdent, "700000000004");
});

test("returns own timesheets sorted by date descending", async () => {
  const response = await routeRequest(request("GET", "/odata/MyTimesheets"));
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 3);
  assert.deepEqual(
    body.value.map((day) => day.date),
    ["2026-04-13", "2026-04-10", "2026-04-09"],
  );
});

test("filters timesheets by date", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyTimesheets?date=2026-04-10"),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.value.length, 1);
  assert.equal(body.value[0].status, "A");
  assert.equal(
    body.value[0].rejectionReason,
    "Bitte Projektreferenz in der Beschreibung ergänzen.",
  );
});

test("upserts saved timesheet and returns it on next read", async () => {
  const draft = {
    extNr: "SCHILZ",
    date: "2026-04-13",
    startTime: "08:00",
    endTime: "16:30",
    breakMinutes: 45,
    location: "remote",
    status: "F",
    lines: [{ coIdent: "700000000004", description: "Sprint", hours: 6 }],
  };
  const saveResponse = await routeRequest(
    request("POST", "/odata/TimesheetDays", draft),
  );
  assert.equal(saveResponse.status, 201);
  assert.deepEqual(JSON.parse(saveResponse.body), draft);

  const readResponse = await routeRequest(
    request("GET", "/odata/MyTimesheets?date=2026-04-13"),
  );
  assert.deepEqual(JSON.parse(readResponse.body).value, [draft]);
});

test("creates a new day for an unknown date", async () => {
  const draft = {
    extNr: "SCHILZ",
    date: "2026-04-14",
    startTime: "08:30",
    endTime: "17:30",
    breakMinutes: 30,
    location: "remote",
    status: "E",
    lines: [],
  };
  await routeRequest(request("POST", "/odata/TimesheetDays", draft));
  const response = await routeRequest(request("GET", "/odata/MyTimesheets"));
  assert.equal(JSON.parse(response.body).value.length, 4);
});

test("rejects timesheet without key fields", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", { status: "E" }),
  );
  assert.equal(response.status, 400);
});
