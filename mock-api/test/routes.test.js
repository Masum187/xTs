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
  assert.deepEqual(body.roles, ["user", "approver", "planner", "admin"]);
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

test("derives enabled cost objects from qualifying orders", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 3);
  const implementation = body.value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(implementation.orderedHours, 320);
  assert.equal(implementation.bookedHours, 18);
  assert.equal(implementation.remainingHours, 302);
  assert.equal(implementation.validFrom, "2026-02-01");
  assert.equal(implementation.validTo, "2027-02-28");
});

test("rejected days release their quota again", async () => {
  const response = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const support = JSON.parse(response.body).value.find(
    (item) => item.coIdent === "600000000001",
  );
  assert.equal(support.bookedHours, 0);
  assert.equal(support.remainingHours, 160);
});

test("remaining hours shrink as soon as hours are saved", async () => {
  await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-14",
      startTime: "08:30",
      endTime: "13:00",
      breakMinutes: 0,
      location: "remote",
      status: "E",
      lines: [{ coIdent: "700000000004", description: "Konzept", hours: 4 }],
    }),
  );
  const response = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const implementation = JSON.parse(response.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(implementation.remainingHours, 298);
});

test("rejects timesheet lines without active enablement", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "P",
      active: false,
    }),
  );
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-14",
      startTime: "08:30",
      endTime: "17:30",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      lines: [
        {
          coIdent: "700000000004",
          description: "nicht freigeschaltet",
          hours: 8,
        },
      ],
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(JSON.parse(response.body).error, "COST_OBJECT_NOT_ENABLED");
});

test("rejects timesheet lines outside the enabled period", async () => {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2027-03-01",
      startTime: "08:30",
      endTime: "17:30",
      breakMinutes: 30,
      location: "remote",
      status: "E",
      lines: [
        {
          coIdent: "700000000004",
          description: "nach Beauftragungsende",
          hours: 4,
        },
      ],
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(JSON.parse(response.body).coIdent, "700000000004");
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

  const followUp = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-03-21",
      startTime: "08:00",
      endTime: "09:00",
      breakMinutes: 0,
      location: "remote",
      status: "E",
      lines: [
        { coIdent: "600000000009", description: "Nachbuchung", hours: 1 },
      ],
    }),
  );
  assert.equal(followUp.status, 409);
});

test("cost object quota lists derived enablements with booked hours", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 4);
  assert.equal(body.value[0].lastName, "Roeper");
  assert.equal(body.value[0].orderedHours, 100);
  assert.equal(body.value[0].bookedHours, 15.5);
  assert.equal(body.value[0].remainingHours, 84.5);
  const booked = body.value.find(
    (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
  );
  assert.equal(booked.orderedHours, 320);
  assert.equal(booked.bookedHours, 18);
  assert.equal(booked.remainingHours, 302);
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
  assert.equal(dateRow.bookedHours, 2);
});

test("cost object quota exposes day details with status on request", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota?detail=day"),
  );
  const row = JSON.parse(response.body).value.find(
    (item) => item.extNr === "SCHILZ" && item.coIdent === "700000000004",
  );
  assert.deepEqual(row.days, [
    {
      date: "2026-04-08",
      status: "F",
      description: "Migrationskonzept Kapitel 3",
      hours: 8,
    },
    {
      date: "2026-04-09",
      status: "G",
      description: "Datenmodell Review",
      hours: 8,
    },
    {
      date: "2026-04-13",
      status: "E",
      description: "Daily Projektabstimmung",
      hours: 2,
    },
  ]);
});

test("resource lifecycle aggregates the chain per employee and cost object", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.value.map((row) => `${row.extNr}|${row.coIdent}`),
    [
      "ROEPER|600000000001",
      "SCHILZ|600000000001",
      "SCHILZ|600000000009",
      "SCHILZ|700000000004",
    ],
  );

  const implementation = body.value.find(
    (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
  );
  assert.equal(implementation.description, "SAP-Implementierung");
  assert.equal(implementation.plannedHours, 140);
  assert.equal(implementation.orderedHours, 320);
  assert.equal(implementation.purchaseOrderHours, 320);
  assert.deepEqual(implementation.orders, [
    {
      orderId: "BEAUF-9001",
      status: "bestellt",
      hours: 320,
      periodFrom: "2026-02",
      periodTo: "2027-02",
      banfNumber: "10009001",
      banfItem: "00010",
      ebeln: "4500001234",
      ebelp: "00010",
    },
  ]);
  assert.equal(implementation.recordedHours, 18);
  assert.equal(implementation.approvedHours, 8);
  // Genehmigter Bestandstag ohne WE-Beleg: nicht als Wareneingang zaehlen.
  assert.equal(implementation.goodsReceiptHours, 0);
  assert.equal(implementation.pendingGoodsReceiptHours, 8);
  assert.deepEqual(implementation.goodsReceipts, []);

  const roeper = body.value[0];
  assert.equal(roeper.displayName, "Christian Roeper");
  assert.equal(roeper.plannedHours, 20);
  assert.equal(roeper.orderedHours, 100);
  assert.equal(roeper.recordedHours, 15.5);
  assert.equal(roeper.approvedHours, 0);

  const legacy = body.value.find((row) => row.coIdent === "600000000009");
  assert.equal(legacy.plannedHours, 0);
  assert.equal(legacy.recordedHours, 0);
});

test("resource lifecycle leaves unknown purchase price and invoice data empty", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle"),
  );
  for (const row of JSON.parse(response.body).value) {
    assert.equal(row.purchaseOrderPrice, null);
    assert.equal(row.invoicedHours, null);
    assert.equal(row.invoiceNumber, null);
  }
});

test("resource lifecycle filters by period, purchase order and item", async () => {
  const april = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?from=2026-04&to=2026-04"),
  );
  const aprilRows = JSON.parse(april.body).value;
  assert.deepEqual(
    aprilRows.map((row) => `${row.extNr}|${row.coIdent}`),
    ["ROEPER|600000000001", "SCHILZ|600000000001", "SCHILZ|700000000004"],
  );
  const implementation = aprilRows.find(
    (row) => row.coIdent === "700000000004",
  );
  assert.equal(implementation.plannedHours, 60);
  assert.equal(implementation.recordedHours, 18);
  assert.equal(aprilRows[0].recordedHours, 8);
  const support = aprilRows.find(
    (row) => row.extNr === "SCHILZ" && row.coIdent === "600000000001",
  );
  assert.equal(support.plannedHours, 0);
  assert.equal(support.orderedHours, 160);

  const byOrder = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebeln=4500002001"),
  );
  const byOrderRows = JSON.parse(byOrder.body).value;
  assert.equal(byOrderRows.length, 1);
  assert.equal(byOrderRows[0].extNr, "SCHILZ");
  assert.equal(byOrderRows[0].coIdent, "600000000001");

  const byItem = await routeRequest(
    approverRequest(
      "GET",
      "/odata/ResourceLifecycle?ebeln=4500002001&ebelp=00020",
    ),
  );
  assert.deepEqual(JSON.parse(byItem.body).value, []);

  const allItems = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebelp=00010"),
  );
  assert.equal(JSON.parse(allItems.body).value.length, 4);
});

test("resource lifecycle rejects invalid period filters", async () => {
  const badFormat = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?from=04.2026"),
  );
  assert.equal(badFormat.status, 400);
  assert.equal(JSON.parse(badFormat.body).error, "INVALID_LIFECYCLE_PERIOD");

  const reversedRange = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?from=2026-05&to=2026-04"),
  );
  assert.equal(reversedRange.status, 400);
  assert.equal(
    JSON.parse(reversedRange.body).error,
    "INVALID_LIFECYCLE_PERIOD",
  );
});

test("resource lifecycle shows goods receipts from approved days", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "approve",
    }),
  );
  const response = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebeln=4500001234"),
  );
  const row = JSON.parse(response.body).value[0];
  assert.equal(row.approvedHours, 16);
  assert.equal(row.goodsReceiptHours, 8);
  assert.equal(row.pendingGoodsReceiptHours, 8);
  assert.deepEqual(row.goodsReceipts, [
    { weDocument: "WE-000001", date: "2026-04-08", hours: 8 },
  ]);
});

test("resource lifecycle picks up new orders, BANF and purchase orders", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-05",
    }),
  );
  const created = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-05"],
    }),
  );
  const { orderId } = JSON.parse(created.body);

  const beforeBanf = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebeln=4500001234"),
  );
  const rowBefore = JSON.parse(beforeBanf.body).value[0];
  assert.equal(rowBefore.orderedHours, 400);
  assert.equal(rowBefore.purchaseOrderHours, 320);
  const openOrder = rowBefore.orders.find((order) => order.orderId === orderId);
  assert.equal(openOrder.status, "created");
  assert.equal(openOrder.banfNumber, null);
  assert.equal(openOrder.ebeln, null);

  await routeRequest(approverRequest("POST", "/odata/OrderBanfs", { orderId }));
  await routeRequest(approverRequest("POST", "/odata/PurchaseOrderSyncRuns"));

  const afterSync = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebeln=4500001234"),
  );
  const rowAfter = JSON.parse(afterSync.body).value[0];
  assert.equal(rowAfter.purchaseOrderHours, 400);
  const syncedOrder = rowAfter.orders.find(
    (order) => order.orderId === orderId,
  );
  assert.equal(syncedOrder.status, "bestellt");
  assert.equal(syncedOrder.banfNumber, "10000001");
  assert.equal(syncedOrder.ebeln, "4500001234");
});

test("reporting endpoints require the approver role", async () => {
  const budget = await routeRequest(request("GET", "/odata/BudgetMonitor"));
  assert.equal(budget.status, 403);
  const quota = await routeRequest(request("GET", "/odata/CostObjectQuota"));
  assert.equal(quota.status, 403);
  const lifecycle = await routeRequest(
    request("GET", "/odata/ResourceLifecycle"),
  );
  assert.equal(lifecycle.status, 403);
});

test("planning overview shows 12 months with valid combinations", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.months.length, 12);
  assert.equal(body.months[0].month, "2026-03");
  assert.equal(body.months[0].availableHours, 176);
  assert.equal(body.months[11].month, "2027-02");
  assert.equal(body.months[11].availableHours, 160);
  assert.equal(body.rows.length, 4);

  const lockedCell = body.rows
    .find((row) => row.extNr === "SCHILZ" && row.coIdent === "600000000001")
    .cells.find((cell) => cell.month === "2026-03");
  assert.equal(lockedCell.valid, true);
  assert.equal(lockedCell.status, "P");
  assert.equal(lockedCell.locked, true);

  const releasedCell = body.rows
    .find((row) => row.extNr === "ROEPER" && row.coIdent === "600000000001")
    .cells.find((cell) => cell.month === "2026-04");
  assert.equal(releasedCell.status, "F");
  assert.equal(releasedCell.locked, true);
});

test("planning overview locks months outside the cost object validity", async () => {
  const response = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  const row = JSON.parse(response.body).rows.find(
    (item) => item.extNr === "SCHILZ" && item.coIdent === "600000000009",
  );
  assert.equal(row.cells.find((cell) => cell.month === "2026-03").valid, true);
  const expiredCell = row.cells.find((cell) => cell.month === "2026-04");
  assert.equal(expiredCell.valid, false);
  assert.equal(expiredCell.locked, true);
});

test("planning overview filters by employee, team and cost object", async () => {
  const byEmployee = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?extNr=ROEPER"),
  );
  assert.equal(JSON.parse(byEmployee.body).rows.length, 1);

  const byTeam = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?team=TRANSFORMATION_MC"),
  );
  const teamRows = JSON.parse(byTeam.body).rows;
  assert.ok(teamRows.every((row) => row.extNr === "SCHILZ"));

  const byCoIdent = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?coIdent=600000000001"),
  );
  assert.equal(JSON.parse(byCoIdent.body).rows.length, 2);

  const badStart = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=03.2026"),
  );
  assert.equal(badStart.status, 400);
});

test("saves new plan hours with status V and updates existing V entries", async () => {
  const created = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "ROEPER",
      coIdent: "600000000001",
      month: "2026-03",
      hours: 40,
    }),
  );
  const createdBody = JSON.parse(created.body);
  assert.equal(created.status, 201);
  assert.equal(createdBody.entry.status, "V");
  assert.equal(createdBody.overbooked, false);

  const updated = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-05",
      hours: 100,
    }),
  );
  assert.equal(JSON.parse(updated.body).entry.hours, 100);
});

test("rejects plan changes for locked entries and unknown combinations", async () => {
  const locked = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "600000000001",
      month: "2026-03",
      hours: 10,
    }),
  );
  assert.equal(locked.status, 409);
  assert.equal(JSON.parse(locked.body).error, "PLANNING_ENTRY_LOCKED");

  const unknown = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "ALTMANN",
      coIdent: "700000000004",
      month: "2026-05",
      hours: 10,
    }),
  );
  assert.equal(unknown.status, 404);

  const expired = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "600000000009",
      month: "2026-05",
      hours: 10,
    }),
  );
  assert.equal(expired.status, 404);
});

test("marks overplanning against the work calendar", async () => {
  const response = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "600000000001",
      month: "2026-04",
      hours: 120,
    }),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.plannedTotal, 180);
  assert.equal(body.availableHours, 168);
  assert.equal(body.overbooked, true);

  const overview = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-04"),
  );
  const cell = JSON.parse(overview.body)
    .rows.find(
      (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
    )
    .cells.find((c) => c.month === "2026-04");
  assert.equal(cell.overbooked, true);
});

test("releases V entries for BANF and locks them afterwards", async () => {
  const released = await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
    }),
  );
  assert.equal(released.status, 200);
  assert.equal(JSON.parse(released.body).entry.status, "F");

  const again = await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
    }),
  );
  assert.equal(again.status, 409);

  const edit = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
      hours: 10,
    }),
  );
  assert.equal(edit.status, 409);

  const missing = await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2027-01",
    }),
  );
  assert.equal(missing.status, 404);
});

test("planning endpoints require the planner role", async () => {
  const overview = await routeRequest(
    request("GET", "/odata/PlanningOverview"),
  );
  assert.equal(overview.status, 403);
  const save = await routeRequest(
    request("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-05",
      hours: 1,
    }),
  );
  assert.equal(save.status, 403);
  const release = await routeRequest(
    request("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
    }),
  );
  assert.equal(release.status, 403);
});

async function seedReleasedRow(extNr, coIdent, month, hours) {
  await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr,
      coIdent,
      month,
      hours,
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr,
      coIdent,
      month,
    }),
  );
}

test("order candidates group released rows per employee and cost object", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);
  await seedReleasedRow("SCHILZ", "700000000004", "2026-05", 80);

  const response = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates"),
  );
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 2);
  const schilz = body.value.find((item) => item.extNr === "SCHILZ");
  assert.deepEqual(schilz.months, ["2026-04", "2026-05"]);
  assert.equal(schilz.totalHours, 140);
  assert.equal(schilz.periodFrom, "2026-04");
  assert.equal(schilz.periodTo, "2026-05");
  const roeper = body.value.find((item) => item.extNr === "ROEPER");
  assert.equal(roeper.totalHours, 20);
});

test("order candidates support employee, cost object and period filters", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);

  const byEmployee = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates?extNr=ROEPER"),
  );
  assert.equal(JSON.parse(byEmployee.body).value.length, 1);

  const byPeriod = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates?from=2026-05&to=2026-12"),
  );
  assert.equal(JSON.parse(byPeriod.body).value.length, 0);
});

test("deactivating the aggregation rule disables order candidates", async () => {
  const initial = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates"),
  );
  assert.ok(JSON.parse(initial.body).value.length > 0);

  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 1,
      value: "MA_KONT",
      active: false,
    }),
  );
  const response = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates"),
  );
  assert.deepEqual(JSON.parse(response.body).value, []);
});

test("creates an order from planning rows and keeps references", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);
  await seedReleasedRow("SCHILZ", "700000000004", "2026-05", 80);

  const response = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04", "2026-05"],
      text: "SAP-Implementierung Q2",
    }),
  );
  const order = JSON.parse(response.body);
  assert.equal(response.status, 201);
  assert.equal(order.orderId, "BEAUF-000001");
  assert.equal(order.hours, 140);
  assert.equal(order.periodFrom, "2026-04");
  assert.equal(order.periodTo, "2026-05");
  assert.deepEqual(order.planningRefs, ["2026-04", "2026-05"]);
  assert.equal(order.status, "created");

  const candidates = await routeRequest(
    approverRequest("GET", "/odata/OrderCandidates?extNr=SCHILZ"),
  );
  assert.equal(JSON.parse(candidates.body).value.length, 0);

  const again = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04"],
    }),
  );
  assert.equal(again.status, 409);
});

test("rejects duplicate planning references in one order", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);

  const response = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04", "2026-04"],
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(JSON.parse(response.body).error, "DUPLICATE_PLANNING_REFS");
});

test("order text stays editable until the BANF exists", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);
  await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04"],
    }),
  );

  const renamed = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      orderId: "BEAUF-000001",
      text: "Neuer BANF-Positionstext",
    }),
  );
  assert.equal(JSON.parse(renamed.body).text, "Neuer BANF-Positionstext");

  const blank = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      orderId: "BEAUF-000001",
      text: "   ",
    }),
  );
  assert.equal(blank.status, 400);

  await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000001" }),
  );
  const locked = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      orderId: "BEAUF-000001",
      text: "zu spaet",
    }),
  );
  assert.equal(locked.status, 409);
});

test("BANF creation writes back numbers and sets planning to P", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);
  await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04"],
    }),
  );

  const response = await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000001" }),
  );
  const order = JSON.parse(response.body);
  assert.equal(response.status, 201);
  assert.equal(order.status, "banf");
  assert.equal(order.banfNumber, "10000001");
  assert.equal(order.banfItem, "00010");

  const overview = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-04"),
  );
  const cell = JSON.parse(overview.body)
    .rows.find(
      (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
    )
    .cells.find((candidate) => candidate.month === "2026-04");
  assert.equal(cell.status, "P");
  assert.equal(cell.locked, true);

  const duplicate = await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000001" }),
  );
  assert.equal(duplicate.status, 409);
  const protocol = await routeRequest(
    approverRequest("GET", "/odata/OrderProtocol"),
  );
  assert.equal(JSON.parse(protocol.body).value.length, 1);
});

test("purchase order sync updates found orders and logs missing ones", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-04", 60);
  await seedReleasedRow("SCHILZ", "600000000001", "2026-04", 25);
  await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04"],
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "600000000001",
      months: ["2026-04"],
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000001" }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000002" }),
  );

  const response = await routeRequest(
    approverRequest("POST", "/odata/PurchaseOrderSyncRuns"),
  );
  const body = JSON.parse(response.body);
  assert.equal(body.updated, 1);
  assert.equal(body.errors.length, 1);
  assert.match(body.errors[0].message, /Keine Bestellung zur BANF 10000002/);

  const orders = await routeRequest(approverRequest("GET", "/odata/Orders"));
  const list = JSON.parse(orders.body).value;
  const done = list.find((order) => order.orderId === "BEAUF-000001");
  assert.equal(done.status, "bestellt");
  assert.equal(done.ebeln, "4500001234");
  assert.equal(done.ebelp, "00010");
  assert.equal(
    list.find((order) => order.orderId === "BEAUF-000002").status,
    "banf",
  );

  const overview = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-04"),
  );
  const cell = JSON.parse(overview.body)
    .rows.find(
      (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
    )
    .cells.find((candidate) => candidate.month === "2026-04");
  assert.equal(cell.status, "B");
});

test("order endpoints require the planner role", async () => {
  const candidates = await routeRequest(
    request("GET", "/odata/OrderCandidates"),
  );
  assert.equal(candidates.status, 403);
  const create = await routeRequest(
    request("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-04"],
    }),
  );
  assert.equal(create.status, 403);
  const sync = await routeRequest(
    request("POST", "/odata/PurchaseOrderSyncRuns"),
  );
  assert.equal(sync.status, 403);
});

test("rules are readable and validated for admins", async () => {
  const list = await routeRequest(approverRequest("GET", "/odata/Rules"));
  const body = JSON.parse(list.body);
  assert.equal(list.status, 200);
  assert.deepEqual(body.value, [
    { infotype: 1, value: "MA_KONT", active: true },
    { infotype: 2, value: "P", active: true },
  ]);

  const invalidValue = await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "X",
      active: true,
    }),
  );
  assert.equal(invalidValue.status, 400);

  const invalidActive = await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "P",
      active: "ja",
    }),
  );
  assert.equal(invalidActive.status, 400);

  const nonAdmin = await routeRequest(request("GET", "/odata/Rules"));
  assert.equal(nonAdmin.status, 403);
});

test("switching the enablement rule to B drops BANF-only orders", async () => {
  await seedReleasedRow("SCHILZ", "700000000004", "2026-06", 50);
  await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      months: ["2026-06"],
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/OrderBanfs", { orderId: "BEAUF-000001" }),
  );

  const withBanf = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const enabledWithBanf = JSON.parse(withBanf.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(enabledWithBanf.orderedHours, 370);
  assert.equal(enabledWithBanf.validTo, "2027-02-28");

  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "B",
      active: true,
    }),
  );
  const withOrderOnly = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const enabledOrdered = JSON.parse(withOrderOnly.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(enabledOrdered.orderedHours, 320);

  const budget = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  const budgetRow = JSON.parse(budget.body).value.find(
    (row) => row.coIdent === "700000000004",
  );
  assert.equal(budgetRow.budgetHours, 320);
});

test("deactivating the enablement rule disables timesheet cost objects", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "P",
      active: false,
    }),
  );
  const enabled = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  assert.equal(JSON.parse(enabled.body).value.length, 0);
  const budget = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  assert.equal(JSON.parse(budget.body).value.length, 0);
});

test("employee maintenance validates required fields and stamps changes", async () => {
  const invalid = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "",
      firstName: " ",
      lastName: "",
      active: "yes",
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(JSON.parse(invalid.body).error, "INVALID_EMPLOYEE");
  assert.deepEqual(JSON.parse(invalid.body).fields, [
    "EXTNR",
    "NACHNAME",
    "VORNAME",
    "STATUS",
  ]);

  const unknownManager = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "tester",
      firstName: "Toni",
      lastName: "Tester",
      active: true,
      resourceManager: "NIEMAND",
    }),
  );
  assert.equal(unknownManager.status, 400);
  assert.equal(
    JSON.parse(unknownManager.body).error,
    "UNKNOWN_RESOURCE_MANAGER",
  );

  const created = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "tester",
      firstName: "Toni",
      lastName: "Tester",
      company: "QualityTimes",
      active: true,
      resourceManager: "ROEPER",
    }),
  );
  const employee = JSON.parse(created.body);
  assert.equal(created.status, 200);
  assert.equal(employee.extNr, "TESTER");
  assert.equal(employee.displayName, "Toni Tester");
  assert.equal(employee.resourceManager, "ROEPER");
  assert.deepEqual(employee.roles, ["user"]);
  assert.equal(employee.changedBy, "ROEPER");
  assert.match(employee.changedAt, /^\d{4}-\d{2}-\d{2}T/);

  const listed = await routeRequest(request("GET", "/odata/Employees"));
  assert.ok(
    JSON.parse(listed.body).value.some((item) => item.extNr === "TESTER"),
  );

  await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      ...employee,
      deleted: true,
    }),
  );
  const afterDelete = await routeRequest(request("GET", "/odata/Employees"));
  assert.ok(
    !JSON.parse(afterDelete.body).value.some((item) => item.extNr === "TESTER"),
  );
  const withDeleted = await routeRequest(
    request("GET", "/odata/Employees?includeDeleted=true"),
  );
  assert.ok(
    JSON.parse(withDeleted.body).value.some(
      (item) => item.extNr === "TESTER" && item.deleted === true,
    ),
  );
});

test("logically deleted employees lose their access", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "SCHILZ",
      firstName: "Stephan",
      lastName: "Schilz",
      active: true,
      deleted: true,
    }),
  );
  const profile = await routeRequest(request("GET", "/odata/MyProfile"));
  assert.equal(profile.status, 403);
  assert.equal(JSON.parse(profile.body).error, "EMPLOYEE_INACTIVE");
  const planning = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  assert.ok(
    !JSON.parse(planning.body).rows.some((row) => row.extNr === "SCHILZ"),
  );
});

test("inactive or deleted teams are not offered in selections", async () => {
  const invalid = await routeRequest(
    approverRequest("POST", "/odata/Teams", { id: "qa", active: true }),
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(invalid.body).fields, ["NAME"]);

  const created = await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "qa",
      name: "QA",
      active: false,
    }),
  );
  assert.equal(created.status, 200);
  assert.equal(JSON.parse(created.body).id, "QA");

  const offered = await routeRequest(request("GET", "/odata/Teams"));
  assert.deepEqual(
    JSON.parse(offered.body).value.map((team) => team.id),
    ["TRANSFORMATION_MC", "ENTW_SUPPORT"],
  );
  const all = await routeRequest(
    request("GET", "/odata/Teams?includeInactive=true"),
  );
  assert.equal(JSON.parse(all.body).value.length, 3);

  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "ENTW_SUPPORT",
      name: "Entw.-Support",
      active: true,
      deleted: true,
    }),
  );
  const afterDelete = await routeRequest(request("GET", "/odata/Teams"));
  assert.deepEqual(
    JSON.parse(afterDelete.body).value.map((team) => team.id),
    ["TRANSFORMATION_MC"],
  );
});

test("team assignments require validity, reject overlaps and drive planning filters", async () => {
  const missing = await routeRequest(
    approverRequest("POST", "/odata/TeamAssignments", {
      extNr: "SCHILZ",
      teamId: "ENTW_SUPPORT",
    }),
  );
  assert.equal(missing.status, 400);
  assert.deepEqual(JSON.parse(missing.body).fields, [
    "GUELTIG_VON",
    "GUELTIG_BIS",
  ]);

  const overlap = await routeRequest(
    approverRequest("POST", "/odata/TeamAssignments", {
      extNr: "SCHILZ",
      teamId: "ENTW_SUPPORT",
      validFrom: "2026-06-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(overlap.status, 409);
  assert.equal(JSON.parse(overlap.body).error, "TEAM_ASSIGNMENT_OVERLAP");
  assert.equal(JSON.parse(overlap.body).conflictId, "MT-000001");

  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "QA",
      name: "QA",
      active: false,
    }),
  );
  const inactiveTeam = await routeRequest(
    approverRequest("POST", "/odata/TeamAssignments", {
      extNr: "SCHILZ",
      teamId: "QA",
      validFrom: "2027-01-01",
      validTo: "2027-12-31",
    }),
  );
  assert.equal(inactiveTeam.status, 409);
  assert.equal(JSON.parse(inactiveTeam.body).error, "TEAM_NOT_AVAILABLE");

  const created = await routeRequest(
    approverRequest("POST", "/odata/TeamAssignments", {
      extNr: "SCHILZ",
      teamId: "ENTW_SUPPORT",
      validFrom: "2027-01-01",
      validTo: "2027-12-31",
    }),
  );
  assert.equal(created.status, 200);
  assert.equal(JSON.parse(created.body).id, "MT-000004");

  const oldTeam = await routeRequest(
    approverRequest(
      "GET",
      "/odata/PlanningOverview?start=2027-01&team=TRANSFORMATION_MC",
    ),
  );
  assert.deepEqual(JSON.parse(oldTeam.body).rows, []);
  const newTeam = await routeRequest(
    approverRequest(
      "GET",
      "/odata/PlanningOverview?start=2027-01&team=ENTW_SUPPORT",
    ),
  );
  const schilzRows = JSON.parse(newTeam.body).rows.filter(
    (row) => row.extNr === "SCHILZ",
  );
  assert.equal(schilzRows.length, 1);
  assert.equal(schilzRows[0].teamId, "ENTW_SUPPORT");
  const current = await routeRequest(
    approverRequest(
      "GET",
      "/odata/PlanningOverview?start=2026-03&team=TRANSFORMATION_MC",
    ),
  );
  assert.ok(
    JSON.parse(current.body).rows.some((row) => row.extNr === "SCHILZ"),
  );
});

test("cost objects validate their type and can be checked against the SAP CO stub", async () => {
  const badType = await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000042",
      type: "XX",
      description: "QA Kostenstelle",
      active: true,
    }),
  );
  assert.equal(badType.status, 400);
  assert.equal(JSON.parse(badType.body).error, "INVALID_COST_OBJECT_TYPE");
  assert.deepEqual(JSON.parse(badType.body).allowed, [
    "KS",
    "OR",
    "PR",
    "FB",
    "KL",
  ]);

  const created = await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000042",
      type: "ks",
      description: "QA Kostenstelle",
      active: true,
    }),
  );
  const costObject = JSON.parse(created.body);
  assert.equal(created.status, 200);
  assert.equal(costObject.id, "000004");
  assert.equal(costObject.type, "KS");
  assert.equal(costObject.changedBy, "ROEPER");

  const valid = await routeRequest(
    approverRequest("POST", "/odata/CostObjectChecks", {
      coIdent: "600000000042",
      type: "KS",
    }),
  );
  assert.equal(JSON.parse(valid.body).valid, true);
  assert.equal(JSON.parse(valid.body).source, "SAP-CO-Stub");
  const wrongType = await routeRequest(
    approverRequest("POST", "/odata/CostObjectChecks", {
      coIdent: "600000000042",
      type: "OR",
    }),
  );
  assert.equal(JSON.parse(wrongType.body).valid, false);
  const unknown = await routeRequest(
    approverRequest("POST", "/odata/CostObjectChecks", {
      coIdent: "123",
      type: "KS",
    }),
  );
  assert.equal(JSON.parse(unknown.body).valid, false);
  assert.match(JSON.parse(unknown.body).message, /nicht bekannt/);
});

test("deleted cost objects are no longer offered for planning or timesheets", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000001",
      type: "KS",
      description: "SAP-Support, Stephan Schilz",
      active: true,
      deleted: true,
    }),
  );
  const listed = await routeRequest(request("GET", "/odata/CostObjects"));
  assert.ok(
    !JSON.parse(listed.body).value.some(
      (item) => item.coIdent === "600000000001",
    ),
  );
  const planning = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  assert.ok(
    !JSON.parse(planning.body).rows.some(
      (row) => row.coIdent === "600000000001",
    ),
  );
  const enabled = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  assert.ok(
    !JSON.parse(enabled.body).value.some(
      (item) => item.coIdent === "600000000001",
    ),
  );
  const saved = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-14",
      startTime: "08:00",
      endTime: "10:00",
      breakMinutes: 0,
      location: "remote",
      status: "E",
      lines: [{ coIdent: "600000000001", description: "Support", hours: 2 }],
    }),
  );
  assert.equal(saved.status, 409);
  assert.equal(JSON.parse(saved.body).error, "COST_OBJECT_NOT_ENABLED");
});

test("cost object assignments create planning rows and reject overlaps", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000042",
      type: "KS",
      description: "QA Kostenstelle",
      active: true,
    }),
  );
  const unknownCostObject = await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      extNr: "SCHILZ",
      coIdent: "999",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(unknownCostObject.status, 409);
  assert.equal(
    JSON.parse(unknownCostObject.body).error,
    "COST_OBJECT_NOT_AVAILABLE",
  );
  const missing = await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      extNr: "SCHILZ",
      coIdent: "600000000042",
      validFrom: "2026-12-31",
      validTo: "2026-01-01",
    }),
  );
  assert.equal(missing.status, 400);
  assert.equal(JSON.parse(missing.body).error, "INVALID_ASSIGNMENT");

  const created = await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      extNr: "SCHILZ",
      coIdent: "600000000042",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  const assignment = JSON.parse(created.body);
  assert.equal(created.status, 200);
  assert.equal(assignment.id, "000005");
  assert.equal(assignment.description, "QA Kostenstelle, Stephan Schilz");

  const overlap = await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      extNr: "SCHILZ",
      coIdent: "600000000042",
      validFrom: "2026-06-01",
      validTo: "2026-08-31",
    }),
  );
  assert.equal(overlap.status, 409);
  assert.equal(JSON.parse(overlap.body).error, "ASSIGNMENT_OVERLAP");

  const planning = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  const row = JSON.parse(planning.body).rows.find(
    (item) => item.extNr === "SCHILZ" && item.coIdent === "600000000042",
  );
  assert.ok(row);
  assert.equal(row.description, "QA Kostenstelle, Stephan Schilz");
  assert.equal(row.cells[1].valid, true);

  await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      ...assignment,
      deleted: true,
    }),
  );
  const afterDelete = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  assert.ok(
    !JSON.parse(afterDelete.body).rows.some(
      (item) => item.coIdent === "600000000042",
    ),
  );
});

test("master data writes require the admin role", async () => {
  for (const path of [
    "/odata/Employees",
    "/odata/Teams",
    "/odata/TeamAssignments",
    "/odata/CostObjects",
    "/odata/CostObjectAssignments",
    "/odata/CostObjectChecks",
  ]) {
    const response = await routeRequest(request("POST", path, {}));
    assert.equal(response.status, 403, path);
    assert.equal(JSON.parse(response.body).error, "NOT_AUTHORIZED");
  }
});
