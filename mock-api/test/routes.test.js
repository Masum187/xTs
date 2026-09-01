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
  assert.equal(body.value.length, 4);
  assert.deepEqual(
    body.value.map((day) => day.date),
    ["2026-04-13", "2026-04-10", "2026-04-09", "2026-04-08"],
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
  assert.equal(JSON.parse(response.body).value.length, 5);
});

test("lists only submitted days for approval with employee names", async () => {
  const response = await routeRequest(
    request("GET", "/odata/ApprovalTimesheets"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.value.map((day) => [day.extNr, day.date]),
    [
      ["ROEPER", "2026-03-31"],
      ["ROEPER", "2026-04-08"],
      ["SCHILZ", "2026-04-08"],
    ],
  );
  assert.equal(body.value[0].displayName, "Christian Roeper");
});

test("filters approval list by month and employee", async () => {
  const response = await routeRequest(
    request("GET", "/odata/ApprovalTimesheets?month=2026-04&extNr=ROEPER"),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.value.length, 1);
  assert.equal(body.value[0].date, "2026-04-08");
});

test("approves a submitted day and posts a goods receipt", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "approve",
    }),
  );
  const day = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(day.status, "G");
  assert.equal(day.approvedBy, "ROEPER");
  assert.ok(day.approvedAt);
  assert.equal(day.weDocument, "WE-000001");

  const approvals = await routeRequest(
    request("GET", "/odata/ApprovalTimesheets?extNr=SCHILZ"),
  );
  assert.equal(JSON.parse(approvals.body).value.length, 0);
});

test("rejects a submitted day with a reason", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetApprovals", {
      extNr: "ROEPER",
      date: "2026-04-08",
      action: "reject",
      reason: "Bitte Positionsbeschreibung präzisieren.",
    }),
  );
  const day = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(day.status, "A");
  assert.equal(day.rejectionReason, "Bitte Positionsbeschreibung präzisieren.");
});

test("requires a reason for rejection", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetApprovals", {
      extNr: "ROEPER",
      date: "2026-04-08",
      action: "reject",
    }),
  );
  assert.equal(response.status, 400);
});

test("refuses approval for days that are not submitted", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-09",
      action: "approve",
    }),
  );
  assert.equal(response.status, 409);
});

test("excludes other employees from own timesheets", async () => {
  const response = await routeRequest(request("GET", "/odata/MyTimesheets"));
  const body = JSON.parse(response.body);
  assert.ok(body.value.every((day) => day.extNr === "SCHILZ"));
});

test("rejects timesheet without key fields", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", { status: "E" }),
  );
  assert.equal(response.status, 400);
});
