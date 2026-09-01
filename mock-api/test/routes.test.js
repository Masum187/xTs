import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { resetTimesheetStore, routeRequest } from "../src/routes.js";

const APPROVER_UPN = "christian.roeper@qualitytimes.de";

function request(method, url, body, headers = {}) {
  const stream = Readable.from(body ? [JSON.stringify(body)] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

function approverRequest(method, url, body) {
  return request(method, url, body, { "x-mock-oauth-upn": APPROVER_UPN });
}

test.beforeEach(() => {
  resetTimesheetStore();
});

test("returns employee profile with roles for the default persona", async () => {
  const response = await routeRequest(request("GET", "/odata/MyProfile"));
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.extNr, "SCHILZ");
  assert.deepEqual(body.roles, ["user"]);
});

test("returns approver role for the approver persona", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/MyProfile"),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.extNr, "ROEPER");
  assert.deepEqual(body.roles, ["user", "approver"]);
});

test("rejects an OAuth user without EXTNR mapping", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-upn": "neu.extern@qualitytimes.de",
    }),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 404);
  assert.equal(body.error, "NO_EXTNR_MAPPING");
  assert.equal(body.upn, "neu.extern@qualitytimes.de");
});

test("rejects an unknown OAuth user like an unmapped one", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-upn": "unbekannt@qualitytimes.de",
    }),
  );
  assert.equal(response.status, 404);
  assert.equal(JSON.parse(response.body).error, "NO_EXTNR_MAPPING");
});

test("rejects an inactive employee", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-upn": "petra.altmann@qualitytimes.de",
    }),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 403);
  assert.equal(body.error, "EMPLOYEE_INACTIVE");
  assert.equal(body.extNr, "ALTMANN");
});

test("denies approval endpoints without approver role", async () => {
  const list = await routeRequest(request("GET", "/odata/ApprovalTimesheets"));
  assert.equal(list.status, 403);
  assert.equal(JSON.parse(list.body).error, "NOT_AUTHORIZED");

  const action = await routeRequest(
    request("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "approve",
    }),
  );
  assert.equal(action.status, 403);
});

test("denies saving timesheets for a foreign extNr", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "ROEPER",
      date: "2026-04-14",
      status: "E",
      lines: [],
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error, "NOT_AUTHORIZED");
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
    approverRequest("GET", "/odata/ApprovalTimesheets"),
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
    approverRequest(
      "GET",
      "/odata/ApprovalTimesheets?month=2026-04&extNr=ROEPER",
    ),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.value.length, 1);
  assert.equal(body.value[0].date, "2026-04-08");
});

test("approves a submitted day and posts a goods receipt", async () => {
  const response = await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
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
    approverRequest("GET", "/odata/ApprovalTimesheets?extNr=SCHILZ"),
  );
  assert.equal(JSON.parse(approvals.body).value.length, 0);
});

test("rejects a submitted day with a reason", async () => {
  const response = await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
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
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "ROEPER",
      date: "2026-04-08",
      action: "reject",
    }),
  );
  assert.equal(response.status, 400);
});

test("refuses approval for days that are not submitted", async () => {
  const response = await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
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

test("budget monitor aggregates approved hours per cost object", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.value.map((row) => row.coIdent),
    ["600000000001", "600000000009", "700000000004"],
  );
  const implementation = body.value.find(
    (row) => row.coIdent === "700000000004",
  );
  assert.equal(implementation.budgetHours, 320);
  assert.equal(implementation.consumedHours, 8);
  assert.equal(implementation.consumedPercent, 2.5);
  assert.equal(implementation.remainingHours, 312);
  assert.equal(implementation.trafficLight, "green");
  const shared = body.value.find((row) => row.coIdent === "600000000001");
  assert.equal(shared.budgetHours, 260);
  assert.equal(implementation.byEmployee, undefined);
});

test("budget monitor supports employee and day detail levels", async () => {
  const employeeLevel = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor?detail=employee"),
  );
  const employeeRow = JSON.parse(employeeLevel.body).value.find(
    (row) => row.coIdent === "700000000004",
  );
  assert.deepEqual(employeeRow.byEmployee, [
    { extNr: "SCHILZ", displayName: "Stephan Schilz", hours: 8 },
  ]);

  const dayLevel = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor?detail=day"),
  );
  const dayRow = JSON.parse(dayLevel.body).value.find(
    (row) => row.coIdent === "700000000004",
  );
  assert.deepEqual(dayRow.byEmployee[0].days, [
    { date: "2026-04-09", description: "Datenmodell Review", hours: 8 },
  ]);
});

test("budget monitor traffic light turns red from customizing thresholds", async () => {
  await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-03-20",
      startTime: "08:00",
      endTime: "18:00",
      breakMinutes: 0,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "600000000009", description: "Altprojekt", hours: 150 },
      ],
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-03-20",
      action: "approve",
    }),
  );

  const response = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  const row = JSON.parse(response.body).value.find(
    (item) => item.coIdent === "600000000009",
  );
  assert.equal(row.consumedPercent, 187.5);
  assert.equal(row.trafficLight, "red");
  assert.equal(row.remainingHours, -70);
});

test("cost object quota lists enabled cost objects with booked hours", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 4);
  assert.equal(body.value[0].lastName, "Roeper");
  const booked = body.value.find(
    (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
  );
  assert.equal(booked.bookedHours, 8);
  assert.equal(booked.remainingHours, 312);
  assert.equal(booked.teamId, "TRANSFORMATION_MC");
  assert.equal(booked.days, undefined);
});

test("cost object quota filters by last name, team and booking date", async () => {
  const byName = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota?lastName=schi"),
  );
  assert.equal(JSON.parse(byName.body).value.length, 3);

  const byTeam = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota?team=ENTW_SUPPORT"),
  );
  const teamRows = JSON.parse(byTeam.body).value;
  assert.equal(teamRows.length, 1);
  assert.equal(teamRows[0].extNr, "ROEPER");

  const byDate = await routeRequest(
    approverRequest(
      "GET",
      "/odata/CostObjectQuota?from=2026-04-10&to=2026-04-30",
    ),
  );
  const dateRow = JSON.parse(byDate.body).value.find(
    (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
  );
  assert.equal(dateRow.bookedHours, 0);
});

test("cost object quota exposes day details on request", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota?detail=day"),
  );
  const row = JSON.parse(response.body).value.find(
    (item) => item.extNr === "SCHILZ" && item.coIdent === "700000000004",
  );
  assert.deepEqual(row.days, [
    { date: "2026-04-09", description: "Datenmodell Review", hours: 8 },
  ]);
});

test("reporting endpoints require the approver role", async () => {
  const budget = await routeRequest(request("GET", "/odata/BudgetMonitor"));
  assert.equal(budget.status, 403);
  const quota = await routeRequest(request("GET", "/odata/CostObjectQuota"));
  assert.equal(quota.status, 403);
});
