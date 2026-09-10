import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { store as masterData } from "../src/masterdata.js";
import {
  InvalidJsonError,
  resetTimesheetStore,
  routeRequest,
} from "../src/routes.js";

const APPROVER_UPN = "christian.roeper@qualitytimes.de";

// Systemdatum der Contract-Tests (Entscheidung 18): das Testdatenpaket liegt
// im April/Mai 2026, erfassbar ist damit 2026-04-01 bis 2026-05-05.
process.env.XTS_TODAY = "2026-05-05";

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
  process.env.XTS_TODAY = "2026-05-05";
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
      endTime: "17:00",
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
  // Systemdatum passend zu den Testdaten (Entscheidung 18).
  process.env.XTS_TODAY = "2027-03-01";
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2027-03-01",
      startTime: "08:30",
      endTime: "17:00",
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
    varianceReason: "Reisezeit ohne Kontierung",
    lines: [{ coIdent: "700000000004", description: "Sprint", hours: 6 }],
  };
  const saveResponse = await routeRequest(
    request("POST", "/odata/TimesheetDays", draft),
  );
  assert.equal(saveResponse.status, 201);
  const stored = { ...draft, workHours: 7.75 };
  assert.deepEqual(JSON.parse(saveResponse.body), stored);

  const readResponse = await routeRequest(
    request("GET", "/odata/MyTimesheets?date=2026-04-13"),
  );
  assert.deepEqual(JSON.parse(readResponse.body).value, [stored]);
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
      extNr: "SCHILZ",
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
      extNr: "SCHILZ",
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
  // Systemdatum passend zu den Testdaten (Entscheidung 18).
  process.env.XTS_TODAY = "2026-04-05";
  // Budget 600000000009 = 80 Std.; acht Tage à 20 Std. ergeben 160 Std. (200 %).
  for (let day = 16; day <= 23; day += 1) {
    const date = `2026-03-${day}`;
    await routeRequest(
      request("POST", "/odata/TimesheetDays", {
        extNr: "SCHILZ",
        date,
        startTime: "00:00",
        endTime: "23:00",
        breakMinutes: 0,
        location: "remote",
        varianceReason: "Testdaten: Positionssumme weicht bewusst ab",
        status: "F",
        lines: [
          { coIdent: "600000000009", description: "Altprojekt", hours: 20 },
        ],
      }),
    );
    await routeRequest(
      approverRequest("POST", "/odata/TimesheetApprovals", {
        extNr: "SCHILZ",
        date,
        action: "approve",
      }),
    );
  }

  const response = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  const row = JSON.parse(response.body).value.find(
    (item) => item.coIdent === "600000000009",
  );
  // Die Freischaltung sperrt ab Rest 0, daher genau 100 % statt 200 %.
  assert.equal(row.consumedPercent, 100);
  assert.equal(row.trafficLight, "red");
  assert.equal(row.remainingHours, 0);

  const followUp = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-03-24",
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
    { infotype: 3, value: "5", active: true },
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

  const listed = await routeRequest(approverRequest("GET", "/odata/Employees"));
  assert.ok(
    JSON.parse(listed.body).value.some((item) => item.extNr === "TESTER"),
  );

  await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      ...employee,
      deleted: true,
    }),
  );
  const afterDelete = await routeRequest(
    approverRequest("GET", "/odata/Employees"),
  );
  assert.ok(
    !JSON.parse(afterDelete.body).value.some((item) => item.extNr === "TESTER"),
  );
  const withDeleted = await routeRequest(
    approverRequest("GET", "/odata/Employees?includeDeleted=true"),
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
    approverRequest("GET", "/odata/Teams?includeInactive=true"),
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

test("test data reset restores the documented UAT package", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "QA",
      name: "QA",
      active: true,
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "approve",
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
    }),
  );

  const denied = await routeRequest(request("POST", "/odata/TestDataResets"));
  assert.equal(denied.status, 403);

  const reset = await routeRequest(
    approverRequest("POST", "/odata/TestDataResets"),
  );
  const body = JSON.parse(reset.body);
  assert.equal(reset.status, 200);
  assert.equal(body.package, "uat-v0.1");
  assert.equal(body.resetBy, "ROEPER");
  assert.deepEqual(body.counts, {
    employees: 5,
    teams: 2,
    costObjects: 3,
    assignments: 4,
    costObjectApprovers: 4,
    planningEntries: 4,
    orders: 4,
    timesheetDays: 6,
  });

  const teams = await routeRequest(request("GET", "/odata/Teams"));
  assert.equal(JSON.parse(teams.body).value.length, 2);
  const approvals = await routeRequest(
    approverRequest("GET", "/odata/ApprovalTimesheets"),
  );
  assert.equal(JSON.parse(approvals.body).value.length, 3);
  const planning = await routeRequest(
    approverRequest("GET", "/odata/PlanningOverview?start=2026-03"),
  );
  const cell = JSON.parse(planning.body)
    .rows.find(
      (row) => row.extNr === "SCHILZ" && row.coIdent === "700000000004",
    )
    .cells.find((item) => item.month === "2026-04");
  assert.equal(cell.status, "V");
});

test("critical status changes are written to the audit log", async () => {
  await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-13",
      startTime: "08:30",
      endTime: "17:30",
      breakMinutes: 30,
      location: "remote",
      varianceReason: "Testdaten: Positionssumme weicht bewusst ab",
      status: "F",
      lines: [{ coIdent: "700000000004", description: "Daily", hours: 2 }],
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-13",
      action: "approve",
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "reject",
      reason: "Bitte präzisieren.",
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "SCHILZ",
      coIdent: "700000000004",
      month: "2026-04",
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 2,
      value: "B",
      active: true,
    }),
  );

  const response = await routeRequest(
    approverRequest("GET", "/odata/AuditLog"),
  );
  const log = JSON.parse(response.body).value;
  assert.equal(response.status, 200);
  assert.deepEqual(
    log.map(
      (entry) => `${entry.category}:${entry.object}:${entry.from}>${entry.to}`,
    ),
    [
      "rule:rule:P/aktiv>B/aktiv",
      "status:planning:V>F",
      "status:timesheet:F>A",
      "status:timesheet:F>G",
      "status:timesheet:E>F",
    ],
  );
  const approval = log.find((entry) => entry.to === "G");
  assert.equal(approval.actor, "ROEPER");
  assert.equal(approval.objectKey, "SCHILZ/2026-04-13");
  assert.equal(approval.details.weDocument, "WE-000001");
  assert.match(approval.message, /Wareneingang WE-000001/);
  const rejection = log.find((entry) => entry.to === "A");
  assert.equal(rejection.details.reason, "Bitte präzisieren.");
  const submission = log.find(
    (entry) => entry.to === "F" && entry.object === "timesheet",
  );
  assert.equal(submission.actor, "SCHILZ");
  assert.match(submission.message, /vorher Entwurf/);
  assert.match(log[0].id, /^LOG-\d{6}$/);
  assert.match(log[0].at, /^\d{4}-\d{2}-\d{2}T/);
});

test("jobs write technical errors to the audit log with details", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/PlanningReleases", {
      extNr: "ROEPER",
      coIdent: "600000000001",
      month: "2026-04",
    }),
  );
  const created = await routeRequest(
    approverRequest("POST", "/odata/Orders", {
      extNr: "ROEPER",
      coIdent: "600000000001",
      months: ["2026-04"],
    }),
  );
  const { orderId } = JSON.parse(created.body);
  await routeRequest(approverRequest("POST", "/odata/OrderBanfs", { orderId }));
  await routeRequest(approverRequest("POST", "/odata/OrderBanfs", { orderId }));
  await routeRequest(approverRequest("POST", "/odata/PurchaseOrderSyncRuns"));

  const errors = await routeRequest(
    approverRequest("GET", "/odata/AuditLog?severity=error"),
  );
  const errorLog = JSON.parse(errors.body).value;
  assert.equal(errorLog.length, 2);
  assert.ok(errorLog.every((entry) => entry.category === "job"));
  const syncError = errorLog.find(
    (entry) => entry.details.source === "po-sync",
  );
  assert.equal(syncError.objectKey, orderId);
  assert.equal(syncError.details.banfNumber, "10000001");
  assert.equal(syncError.details.coIdent, "600000000001");
  assert.match(syncError.message, /Keine Bestellung zur BANF/);
  const banfError = errorLog.find((entry) => entry.details.source === "banf");
  assert.equal(banfError.details.code, "BANF_ALREADY_EXISTS");

  const statusLog = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", "/odata/AuditLog?category=status&object=order"),
      )
    ).body,
  ).value;
  assert.deepEqual(
    statusLog.map((entry) => entry.to),
    ["banf", "created"],
  );
});

test("audit log supports filters, search, limit and admin role", async () => {
  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "QA",
      name: "QA",
      active: true,
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000042",
      type: "KS",
      description: "QA Kostenstelle",
      active: true,
    }),
  );
  await routeRequest(approverRequest("POST", "/odata/TestDataResets"));

  const afterReset = JSON.parse(
    (await routeRequest(approverRequest("GET", "/odata/AuditLog"))).body,
  ).value;
  assert.equal(afterReset.length, 1);
  assert.equal(afterReset[0].category, "system");

  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "QA",
      name: "QA",
      active: true,
    }),
  );
  await routeRequest(
    approverRequest("POST", "/odata/Teams", {
      id: "QA",
      name: "QA",
      active: true,
      deleted: true,
    }),
  );
  const masterdata = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", "/odata/AuditLog?category=masterdata"),
      )
    ).body,
  ).value;
  assert.deepEqual(
    masterdata.map((entry) => `${entry.object}:${entry.objectKey}:${entry.to}`),
    ["Team:QA:gelöscht", "Team:QA:gespeichert"],
  );
  const search = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", "/odata/AuditLog?q=gel%C3%B6scht"),
      )
    ).body,
  ).value;
  assert.equal(search.length, 1);
  const limited = JSON.parse(
    (await routeRequest(approverRequest("GET", "/odata/AuditLog?limit=1")))
      .body,
  ).value;
  assert.equal(limited.length, 1);
  assert.equal(limited[0].to, "gelöscht");
  const today = new Date().toISOString().slice(0, 10);
  const dated = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", `/odata/AuditLog?from=${today}&to=${today}`),
      )
    ).body,
  ).value;
  assert.equal(dated.length, 3);

  const denied = await routeRequest(request("GET", "/odata/AuditLog"));
  assert.equal(denied.status, 403);
});

test("error responses carry a user-readable message", async () => {
  const notEnabled = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-14",
      startTime: "08:00",
      endTime: "10:00",
      breakMinutes: 0,
      location: "remote",
      status: "E",
      lines: [{ coIdent: "600000000009", description: "Alt", hours: 2 }],
    }),
  );
  const notEnabledBody = JSON.parse(notEnabled.body);
  assert.equal(notEnabledBody.error, "COST_OBJECT_NOT_ENABLED");
  assert.equal(
    notEnabledBody.message,
    "Kontierung ist für diesen Tag nicht freigeschaltet. (600000000009)",
  );

  const locked = await routeRequest(
    approverRequest("POST", "/odata/PlanningEntries", {
      extNr: "SCHILZ",
      coIdent: "600000000001",
      month: "2026-03",
      hours: 10,
    }),
  );
  assert.match(
    JSON.parse(locked.body).message,
    /bereits freigegeben oder beauftragt/,
  );

  const invalidEmployee = await routeRequest(
    approverRequest("POST", "/odata/Employees", { extNr: "X", active: true }),
  );
  assert.equal(
    JSON.parse(invalidEmployee.body).message,
    "Der Mitarbeiter kann nicht gespeichert werden, Pflichtfelder fehlen. (NACHNAME, VORNAME)",
  );

  const denied = await routeRequest(request("GET", "/odata/AuditLog"));
  assert.match(JSON.parse(denied.body).message, /Berechtigung/);

  const unknown = await routeRequest(request("GET", "/odata/Nichts"));
  assert.equal(unknown.status, 404);
  assert.match(JSON.parse(unknown.body).message, /nicht verarbeitet/);
});

test("OAuth oid claim maps to EXTNR with upn as fallback", async () => {
  const byOid = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-oid": "7A9E4D21-6C1B-4F3A-8E2D-5B7C9D1E3F42",
    }),
  );
  const oidBody = JSON.parse(byOid.body);
  assert.equal(byOid.status, 200);
  assert.equal(oidBody.extNr, "ROEPER");
  assert.equal(oidBody.mappedBy, "oid");
  assert.equal(oidBody.aadUpn, "christian.roeper@qualitytimes.de");

  const oidWins = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-oid": "7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42",
      "x-mock-oauth-upn": "stephan.schilz@qualitytimes.de",
    }),
  );
  assert.equal(JSON.parse(oidWins.body).extNr, "ROEPER");

  const byUpn = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-upn": "Stephan.Schilz@QualityTimes.de",
    }),
  );
  assert.equal(JSON.parse(byUpn.body).extNr, "SCHILZ");
  assert.equal(JSON.parse(byUpn.body).mappedBy, "upn");

  const unmapped = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-oid": "00000000-0000-4000-8000-000000000099",
      "x-mock-oauth-upn": "neu.extern@qualitytimes.de",
    }),
  );
  const unmappedBody = JSON.parse(unmapped.body);
  assert.equal(unmapped.status, 404);
  assert.equal(unmappedBody.error, "NO_EXTNR_MAPPING");
  assert.equal(unmappedBody.oid, "00000000-0000-4000-8000-000000000099");
  assert.equal(unmappedBody.upn, "neu.extern@qualitytimes.de");
  assert.match(unmappedBody.message, /keinem xTS-Mitarbeiter/);

  const oidOnlyUnknown = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-oid": "00000000-0000-4000-8000-000000000099",
    }),
  );
  assert.equal(oidOnlyUnknown.status, 404);
  assert.equal(JSON.parse(oidOnlyUnknown.body).upn, null);
});

test("admins maintain the Entra mapping and it takes effect immediately", async () => {
  const invalid = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "TESTER",
      firstName: "Toni",
      lastName: "Tester",
      active: true,
      aadOid: "keine-guid",
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(JSON.parse(invalid.body).error, "INVALID_AAD_OID");

  const duplicate = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "TESTER",
      firstName: "Toni",
      lastName: "Tester",
      active: true,
      aadOid: "3f1c2a7e-5b3d-4c8e-9a1f-0d2e4b6c8a10",
    }),
  );
  assert.equal(duplicate.status, 409);
  assert.equal(JSON.parse(duplicate.body).error, "AAD_OID_IN_USE");
  assert.equal(JSON.parse(duplicate.body).conflictId, "SCHILZ");

  const duplicateUpn = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "TESTER",
      firstName: "Toni",
      lastName: "Tester",
      active: true,
      aadUpn: "christian.roeper@qualitytimes.de",
    }),
  );
  assert.equal(duplicateUpn.status, 409);
  assert.equal(JSON.parse(duplicateUpn.body).error, "AAD_UPN_IN_USE");

  const created = await routeRequest(
    approverRequest("POST", "/odata/Employees", {
      extNr: "TESTER",
      firstName: "Toni",
      lastName: "Tester",
      active: true,
      aadOid: "00000000-0000-4000-8000-000000000099",
      aadUpn: "neu.extern@qualitytimes.de",
    }),
  );
  assert.equal(created.status, 200);
  assert.equal(
    JSON.parse(created.body).aadOid,
    "00000000-0000-4000-8000-000000000099",
  );

  const login = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      "x-mock-oauth-oid": "00000000-0000-4000-8000-000000000099",
    }),
  );
  assert.equal(login.status, 200);
  assert.equal(JSON.parse(login.body).extNr, "TESTER");
  assert.equal(JSON.parse(login.body).mappedBy, "oid");
});

function unsignedJwt(claims) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
}

test("bearer tokens are mapped via their oid or preferred_username claims", async () => {
  const byOid = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: `Bearer ${unsignedJwt({
        oid: "7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42",
        preferred_username: "irgendwer@qualitytimes.de",
        name: "Christian Roeper",
      })}`,
    }),
  );
  assert.equal(byOid.status, 200);
  assert.equal(JSON.parse(byOid.body).extNr, "ROEPER");
  assert.equal(JSON.parse(byOid.body).mappedBy, "oid");

  const byUpn = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: `bearer ${unsignedJwt({
        preferred_username: "STEPHAN.SCHILZ@qualitytimes.de",
      })}`,
    }),
  );
  assert.equal(JSON.parse(byUpn.body).extNr, "SCHILZ");
  assert.equal(JSON.parse(byUpn.body).mappedBy, "upn");

  const unmapped = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: `Bearer ${unsignedJwt({
        oid: "00000000-0000-4000-8000-000000000099",
      })}`,
    }),
  );
  assert.equal(unmapped.status, 404);
  assert.equal(JSON.parse(unmapped.body).error, "NO_EXTNR_MAPPING");

  const garbage = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: "Bearer kein.jwt",
    }),
  );
  assert.equal(garbage.status, 401);
  assert.equal(JSON.parse(garbage.body).error, "INVALID_TOKEN");
  assert.match(JSON.parse(garbage.body).message, /erneut an/);

  const malformedClaims = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: `Bearer ${unsignedJwt({
        oid: 123,
        preferred_username: { value: "stephan.schilz@qualitytimes.de" },
      })}`,
    }),
  );
  assert.equal(malformedClaims.status, 401);
  assert.equal(JSON.parse(malformedClaims.body).error, "INVALID_TOKEN");

  // Bearer hat Vorrang vor den Pseudo-Headern.
  const precedence = await routeRequest(
    request("GET", "/odata/MyProfile", undefined, {
      authorization: `Bearer ${unsignedJwt({
        oid: "7a9e4d21-6c1b-4f3a-8e2d-5b7c9d1e3f42",
      })}`,
      "x-mock-oauth-upn": "stephan.schilz@qualitytimes.de",
    }),
  );
  assert.equal(JSON.parse(precedence.body).extNr, "ROEPER");
});

test("employees may only save drafts or submit and cannot touch server fields", async () => {
  for (const status of ["G", "A", "X"]) {
    const response = await routeRequest(
      request("POST", "/odata/TimesheetDays", {
        extNr: "SCHILZ",
        date: "2026-05-11",
        status,
        lines: [{ coIdent: "700000000004", description: "x", hours: 1 }],
      }),
    );
    assert.equal(response.status, 400, status);
    assert.equal(JSON.parse(response.body).error, "INVALID_STATUS");
  }
  const protectedFields = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-11",
      status: "E",
      weDocument: "WE-999999",
      approvedBy: "SCHILZ",
      lines: [{ coIdent: "700000000004", description: "x", hours: 1 }],
    }),
  );
  assert.equal(protectedFields.status, 400);
  assert.equal(JSON.parse(protectedFields.body).error, "PROTECTED_FIELDS");
  assert.deepEqual(JSON.parse(protectedFields.body).fields, [
    "approvedBy",
    "weDocument",
  ]);
  const listed = await routeRequest(request("GET", "/odata/MyTimesheets"));
  assert.ok(
    !JSON.parse(listed.body).value.some((day) => day.date === "2026-05-11"),
  );
});

test("submitted and approved days are locked for employees, rejected days reopen", async () => {
  const approved = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-09",
      status: "E",
      lines: [{ coIdent: "700000000004", description: "x", hours: 1 }],
    }),
  );
  assert.equal(approved.status, 409);
  assert.equal(JSON.parse(approved.body).error, "TIMESHEET_LOCKED");
  assert.match(JSON.parse(approved.body).message, /Status G/);
  const submitted = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      status: "E",
      lines: [{ coIdent: "700000000004", description: "x", hours: 1 }],
    }),
  );
  assert.equal(submitted.status, 409);
  const untouched = await routeRequest(
    request("GET", "/odata/MyTimesheets?date=2026-04-09"),
  );
  assert.equal(JSON.parse(untouched.body).value[0].status, "G");
  assert.equal(
    JSON.parse(untouched.body).value[0].lines[0].description,
    "Datenmodell Review",
  );

  const corrected = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-10",
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      location: "on-site",
      status: "F",
      lines: [
        {
          coIdent: "600000000001",
          description: "Support PRJ-4711",
          hours: 7.5,
        },
      ],
    }),
  );
  assert.equal(corrected.status, 201);
  assert.equal(JSON.parse(corrected.body).status, "F");
  assert.equal(JSON.parse(corrected.body).rejectionReason, undefined);
});

test("submitting requires booked hours and unknown fields are dropped", async () => {
  // Systemdatum passend zu den Testdaten (Entscheidung 18).
  process.env.XTS_TODAY = "2026-05-12";
  const header = {
    startTime: "08:00",
    endTime: "16:30",
    breakMinutes: 30,
    location: "remote",
  };
  const empty = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-12",
      ...header,
      status: "F",
      lines: [],
    }),
  );
  assert.equal(empty.status, 409);
  assert.equal(JSON.parse(empty.body).error, "SUBMIT_REQUIRES_HOURS");
  const zero = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-12",
      status: "F",
      lines: [{ coIdent: "700000000004", description: "x", hours: 0 }],
    }),
  );
  assert.equal(zero.status, 400);
  assert.equal(JSON.parse(zero.body).error, "INVALID_TIMESHEET");
  const missingLines = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-12",
      ...header,
      status: "F",
    }),
  );
  assert.equal(missingLines.status, 409);
  assert.equal(JSON.parse(missingLines.body).error, "SUBMIT_REQUIRES_HOURS");

  const extra = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-12",
      status: "E",
      fremd: "feld",
      lines: [
        { coIdent: "700000000004", description: "x", hours: 1, extra: true },
      ],
    }),
  );
  const saved = JSON.parse(extra.body);
  assert.equal(extra.status, 201);
  assert.equal(saved.fremd, undefined);
  assert.equal(saved.lines[0].extra, undefined);
  const nullLines = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-05-13",
      status: "E",
      lines: null,
    }),
  );
  assert.equal(nullLines.status, 400);
  assert.equal(JSON.parse(nullLines.body).problems[0].code, "LINES_INVALID");
  const quota = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota"),
  );
  assert.equal(quota.status, 200);
});

test("approvers cannot approve or reject their own days", async () => {
  for (const action of ["approve", "reject"]) {
    const response = await routeRequest(
      approverRequest("POST", "/odata/TimesheetApprovals", {
        extNr: "ROEPER",
        date: "2026-04-08",
        action,
        reason: "Grund",
      }),
    );
    assert.equal(response.status, 403, action);
    assert.equal(JSON.parse(response.body).error, "SELF_APPROVAL");
  }
  const still = await routeRequest(
    approverRequest("GET", "/odata/ApprovalTimesheets?extNr=ROEPER"),
  );
  assert.equal(JSON.parse(still.body).value.length, 2);
});

test("rejection reasons made of whitespace are refused", async () => {
  const response = await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "reject",
      reason: "   ",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(JSON.parse(response.body).error, "REJECTION_REASON_REQUIRED");
  const unknownAction = await routeRequest(
    approverRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-08",
      action: "maybe",
    }),
  );
  assert.equal(unknownAction.status, 400);
  assert.equal(JSON.parse(unknownAction.body).error, "INVALID_APPROVAL_ACTION");
});

const validDay = (overrides = {}) => ({
  extNr: "SCHILZ",
  date: "2026-04-15",
  startTime: "08:00",
  endTime: "16:30",
  breakMinutes: 30,
  location: "remote",
  status: "E",
  lines: [{ coIdent: "700000000004", description: "Konzept", hours: 8 }],
  ...overrides,
});

async function saveDay(overrides) {
  const response = await routeRequest(
    request("POST", "/odata/TimesheetDays", validDay(overrides)),
  );
  return { status: response.status, body: JSON.parse(response.body) };
}

test("timesheet payloads are validated: hours", async () => {
  for (const [hours, code] of [
    [-5, "HOURS_RANGE"],
    [25, "HOURS_RANGE"],
    [99999, "HOURS_RANGE"],
    [1.3333, "HOURS_STEP"],
    ["abc", "HOURS_INVALID"],
    [null, "HOURS_INVALID"],
    [Infinity, "HOURS_INVALID"],
  ]) {
    const result = await saveDay({
      lines: [{ coIdent: "700000000004", description: "x", hours }],
    });
    assert.equal(result.status, 400, String(hours));
    assert.equal(result.body.error, "INVALID_TIMESHEET");
    assert.equal(result.body.problems[0].code, code, String(hours));
    assert.deepEqual(result.body.fields, ["lines[0].hours"]);
    assert.match(result.body.message, /Position 1/);
  }
  const zeroDraft = await saveDay({
    lines: [{ coIdent: "700000000004", description: "", hours: 0 }],
  });
  assert.equal(zeroDraft.status, 201);
  const zeroSubmit = await saveDay({
    status: "F",
    lines: [{ coIdent: "700000000004", description: "x", hours: 0 }],
  });
  assert.equal(zeroSubmit.status, 400);
  assert.equal(zeroSubmit.body.problems[0].code, "HOURS_RANGE");
  const tooMuch = await saveDay({
    lines: [
      { coIdent: "700000000004", description: "a", hours: 12 },
      { coIdent: "700000000004", description: "b", hours: 12.25 },
    ],
  });
  assert.equal(tooMuch.status, 400);
  assert.equal(tooMuch.body.problems[0].code, "DAY_HOURS_EXCEEDED");
  const quarter = await saveDay({
    lines: [
      { coIdent: "700000000004", description: "a", hours: 7.5 },
      { coIdent: "700000000004", description: "b", hours: 0.25 },
    ],
  });
  assert.equal(quarter.status, 201);
  const nothingStored = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const remaining = JSON.parse(nothingStored.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(typeof remaining.bookedHours, "number");
});

test("timesheet payloads are validated: date, times, break, location", async () => {
  for (const [overrides, code] of [
    [{ date: "2026-02-30" }, "DATE_INVALID"],
    [{ date: "gestern" }, "DATE_INVALID"],
    [{ startTime: "abc" }, "TIME_FORMAT"],
    [{ endTime: "7:00" }, "TIME_FORMAT"],
    [{ startTime: "17:00", endTime: "08:00" }, "TIME_RANGE"],
    [{ startTime: "08:00", endTime: "08:00" }, "TIME_RANGE"],
    [{ breakMinutes: -30 }, "BREAK_INVALID"],
    [{ breakMinutes: 30.5 }, "BREAK_INVALID"],
    [{ breakMinutes: 600 }, "BREAK_TOO_LONG"],
    [{ location: "moon" }, "LOCATION_INVALID"],
    [{ lines: null }, "LINES_INVALID"],
    [{ lines: [{ description: "x", hours: 1 }] }, "COIDENT_REQUIRED"],
    [
      {
        lines: [
          { coIdent: "700000000004", description: "A".repeat(256), hours: 1 },
        ],
      },
      "DESCRIPTION_TOO_LONG",
    ],
  ]) {
    const result = await saveDay(overrides);
    assert.equal(result.status, 400, JSON.stringify(overrides));
    assert.equal(result.body.problems[0].code, code, JSON.stringify(overrides));
  }
  const draftWithoutHeader = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-15",
      status: "E",
      lines: [{ coIdent: "700000000004", description: "", hours: 1 }],
    }),
  );
  assert.equal(draftWithoutHeader.status, 201);
  const submitWithoutHeader = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-15",
      status: "F",
      lines: [{ coIdent: "700000000004", description: "", hours: 1 }],
    }),
  );
  assert.equal(submitWithoutHeader.status, 400);
  assert.deepEqual(
    JSON.parse(submitWithoutHeader.body).problems.map((item) => item.code),
    [
      "TIME_REQUIRED",
      "TIME_REQUIRED",
      "BREAK_REQUIRED",
      "LOCATION_REQUIRED",
      "DESCRIPTION_REQUIRED",
    ],
  );
  const quotaStillWorks = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota"),
  );
  assert.equal(quotaStillWorks.status, 200);
});

test("invalid JSON bodies are reported as 400, not 500", async () => {
  const stream = request("POST", "/odata/TimesheetDays");
  const broken = Object.assign(Readable.from(["kein json"]), {
    method: "POST",
    url: "/odata/TimesheetDays",
    headers: {},
  });
  void stream;
  await assert.rejects(routeRequest(broken), InvalidJsonError);
});

test("bookings cannot exceed the open quota of a cost object", async () => {
  // Systemdatum passend zu den Testdaten (Entscheidung 18).
  process.env.XTS_TODAY = "2026-09-03";
  // 700000000004: 320 beauftragt, 18 gebucht -> 302 offen.
  const tooMuch = await saveDay({
    date: "2026-08-03",
    startTime: "00:00",
    endTime: "23:59",
    breakMinutes: 0,
    lines: [{ coIdent: "700000000004", description: "a", hours: 24 }],
  });
  assert.equal(tooMuch.status, 201);
  let remaining = 302 - 24;
  const days = [];
  for (let day = 4; day <= 31; day += 1) {
    days.push(`2026-08-${String(day).padStart(2, "0")}`);
  }
  let rejected = null;
  for (const date of days) {
    const result = await saveDay({
      date,
      startTime: "00:00",
      endTime: "23:59",
      breakMinutes: 0,
      lines: [{ coIdent: "700000000004", description: "x", hours: 24 }],
    });
    if (result.status === 409) {
      rejected = result;
      break;
    }
    assert.equal(result.status, 201, date);
    remaining -= 24;
  }
  assert.ok(rejected, "Ueberbuchung wurde nicht abgelehnt");
  assert.equal(rejected.body.error, "COST_OBJECT_QUOTA_EXCEEDED");
  assert.equal(rejected.body.coIdent, "700000000004");
  assert.equal(rejected.body.requested, 24);
  assert.equal(rejected.body.remaining, remaining);
  assert.ok(remaining < 24 && remaining >= 0);
  assert.match(rejected.body.message, /angefragt/);

  const exact = await saveDay({
    date: "2026-09-01",
    startTime: "00:00",
    endTime: "23:59",
    breakMinutes: 0,
    lines: [{ coIdent: "700000000004", description: "rest", hours: remaining }],
  });
  assert.equal(exact.status, 201);
  const after = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const row = JSON.parse(after.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(row.remainingHours, 0);
  const draftZero = await saveDay({
    date: "2026-09-02",
    lines: [{ coIdent: "700000000004", description: "", hours: 0 }],
  });
  assert.equal(draftZero.status, 201);
  const quarter = await saveDay({
    date: "2026-09-03",
    lines: [{ coIdent: "700000000004", description: "x", hours: 0.25 }],
  });
  assert.equal(quarter.status, 409);
  assert.equal(quarter.body.error, "COST_OBJECT_QUOTA_EXCEEDED");
});

test("quota check sums the lines of a day and ignores the day's previous version", async () => {
  const split = await saveDay({
    date: "2026-04-15",
    startTime: "00:00",
    endTime: "23:59",
    breakMinutes: 0,
    lines: [
      { coIdent: "600000000001", description: "a", hours: 12 },
      { coIdent: "600000000001", description: "b", hours: 12 },
    ],
  });
  // 600000000001: 160 offen -> 24 passen.
  assert.equal(split.status, 201);
  const beyond = await saveDay({
    date: "2026-04-14",
    startTime: "00:00",
    endTime: "23:59",
    breakMinutes: 0,
    lines: [
      { coIdent: "600000000001", description: "a", hours: 12 },
      { coIdent: "600000000001", description: "b", hours: 11.75 },
      { coIdent: "700000000004", description: "c", hours: 0.25 },
    ],
  });
  assert.equal(beyond.status, 201);
  // Bisherige Fassung des Tages zaehlt nicht doppelt: 2026-04-15 von 24 auf 20.
  const updated = await saveDay({
    date: "2026-04-15",
    startTime: "00:00",
    endTime: "23:59",
    breakMinutes: 0,
    lines: [{ coIdent: "600000000001", description: "a", hours: 20 }],
  });
  assert.equal(updated.status, 201);
  const state = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const row = JSON.parse(state.body).value.find(
    (item) => item.coIdent === "600000000001",
  );
  assert.equal(row.bookedHours, 43.75);
  assert.equal(row.remainingHours, 116.25);
});

test("hour arithmetic works in whole minutes without floating point drift", async () => {
  // Systemdatum passend zu den Testdaten (Entscheidung 18).
  process.env.XTS_TODAY = "2026-05-06";
  // Planung darf beliebige Dezimalwerte tragen: 0.1 + 0.2 muss exakt 0.3 sein.
  for (const [month, hours] of [
    ["2026-04", 0.1],
    ["2026-05", 0.2],
  ]) {
    await routeRequest(
      approverRequest("POST", "/odata/PlanningEntries", {
        extNr: "SCHILZ",
        coIdent: "700000000004",
        month,
        hours,
      }),
    );
  }
  const lifecycle = await routeRequest(
    approverRequest("GET", "/odata/ResourceLifecycle?ebeln=4500001234"),
  );
  assert.equal(JSON.parse(lifecycle.body).value[0].plannedHours, 0.3);

  // Viertelstunden-Buchungen: 7.75 + 0.25 + 3 x 0.25 + 9.5 = 18.25, plus 18 Bestand.
  const bookings = [
    ["2026-05-04", [7.75, 0.25]],
    ["2026-05-05", [0.25, 0.25, 0.25]],
    ["2026-05-06", [9.5]],
  ];
  for (const [date, hours] of bookings) {
    const result = await saveDay({
      date,
      lines: hours.map((value) => ({
        coIdent: "700000000004",
        description: "x",
        hours: value,
      })),
    });
    assert.equal(result.status, 201, date);
  }
  const enabled = await routeRequest(
    request("GET", "/odata/MyEnabledCostObjects"),
  );
  const row = JSON.parse(enabled.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(row.bookedHours, 36.25);
  assert.equal(row.remainingHours, 283.75);
  const quota = await routeRequest(
    approverRequest("GET", "/odata/CostObjectQuota?lastName=Schilz"),
  );
  const quotaRow = JSON.parse(quota.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(quotaRow.remainingHours, 283.75);
  const budget = await routeRequest(
    approverRequest("GET", "/odata/BudgetMonitor"),
  );
  const budgetRow = JSON.parse(budget.body).value.find(
    (item) => item.coIdent === "700000000004",
  );
  assert.equal(budgetRow.consumedPercent, 2.5);
  assert.equal(budgetRow.remainingHours, 312);
});

test("work hours are derived from the day header and variances need a reason to submit", async () => {
  const draft = await saveDay({
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    lines: [{ coIdent: "700000000004", description: "Konzept", hours: 6 }],
  });
  assert.equal(draft.status, 201);
  assert.equal(draft.body.workHours, 8);
  assert.equal(draft.body.varianceReason, undefined);

  const unexplained = await saveDay({
    status: "F",
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    lines: [{ coIdent: "700000000004", description: "Konzept", hours: 6 }],
  });
  assert.equal(unexplained.status, 400);
  assert.equal(unexplained.body.problems[0].code, "VARIANCE_REASON_REQUIRED");
  assert.match(
    unexplained.body.message,
    /6 Std\.\) weicht von der Arbeitszeit \(8 Std\.\)/,
  );

  const blank = await saveDay({
    status: "F",
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    varianceReason: "   ",
    lines: [{ coIdent: "700000000004", description: "Konzept", hours: 6 }],
  });
  assert.equal(blank.status, 400);

  const explained = await saveDay({
    status: "F",
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    varianceReason: "  Reisezeit ohne Kontierung  ",
    lines: [{ coIdent: "700000000004", description: "Konzept", hours: 6 }],
  });
  assert.equal(explained.status, 201);
  assert.equal(explained.body.workHours, 8);
  assert.equal(explained.body.varianceReason, "Reisezeit ohne Kontierung");

  const matching = await saveDay({
    date: "2026-05-01",
    status: "F",
    startTime: "08:30",
    endTime: "17:00",
    breakMinutes: 30,
    lines: [
      { coIdent: "700000000004", description: "a", hours: 7.75 },
      { coIdent: "700000000004", description: "b", hours: 0.25 },
    ],
  });
  assert.equal(matching.status, 201);

  const tooLong = await saveDay({
    date: "2026-05-02",
    varianceReason: "x".repeat(256),
    lines: [{ coIdent: "700000000004", description: "a", hours: 1 }],
  });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.problems[0].code, "VARIANCE_REASON_TOO_LONG");

  const clientWorkHours = await saveDay({
    date: "2026-05-03",
    startTime: "09:00",
    endTime: "12:00",
    breakMinutes: 0,
    workHours: 99,
    lines: [{ coIdent: "700000000004", description: "a", hours: 3 }],
  });
  assert.equal(clientWorkHours.status, 201);
  assert.equal(clientWorkHours.body.workHours, 3);

  const fixtures = await routeRequest(
    request("GET", "/odata/MyTimesheets?date=2026-04-13"),
  );
  const fixtureDay = JSON.parse(fixtures.body).value[0];
  assert.equal(fixtureDay.workHours, 8.5);
  assert.equal(
    fixtureDay.varianceReason,
    "Restzeit interne Abstimmung ohne Kontierung",
  );
});

test("master data reads require a mapped identity and are scoped by role", async () => {
  const unmapped = await routeRequest(
    request("GET", "/odata/Employees", undefined, {
      "x-mock-oauth-oid": "00000000-0000-4000-8000-000000000099",
    }),
  );
  assert.equal(unmapped.status, 404);
  assert.equal(JSON.parse(unmapped.body).error, "NO_EXTNR_MAPPING");

  // Rolle user: nur der eigene Datensatz, ohne Zugangs-/Personaldetails.
  const own = await routeRequest(request("GET", "/odata/Employees"));
  const ownBody = JSON.parse(own.body).value;
  assert.equal(own.status, 200);
  assert.deepEqual(
    ownBody.map((item) => item.extNr),
    ["SCHILZ"],
  );
  assert.deepEqual(Object.keys(ownBody[0]).sort(), [
    "active",
    "company",
    "displayName",
    "extNr",
    "firstName",
    "lastName",
  ]);

  // Rolle admin (ROEPER): alle Felder, inkl. aadOid/sapAccount.
  const admin = await routeRequest(approverRequest("GET", "/odata/Employees"));
  const adminBody = JSON.parse(admin.body).value;
  assert.equal(adminBody.length, 5);
  assert.ok(adminBody[0].aadOid);
  assert.ok("sapAccount" in adminBody[0]);

  // Geloeschte/inaktive Saetze nur fuer admin.
  for (const path of [
    "/odata/Employees?includeDeleted=true",
    "/odata/Teams?includeInactive=true",
    "/odata/CostObjects?includeDeleted=true",
  ]) {
    const denied = await routeRequest(request("GET", path));
    assert.equal(denied.status, 403, path);
    assert.equal(JSON.parse(denied.body).error, "NOT_AUTHORIZED");
  }

  // Teams und Kontierungen sind fuer angemeldete Nutzer lesbar (Auswahlen).
  assert.equal(
    (await routeRequest(request("GET", "/odata/Teams"))).status,
    200,
  );
  assert.equal(
    (await routeRequest(request("GET", "/odata/CostObjects"))).status,
    200,
  );

  // Zuordnungen nur fuer admin/planner.
  for (const path of [
    "/odata/TeamAssignments",
    "/odata/CostObjectAssignments",
  ]) {
    const denied = await routeRequest(request("GET", path));
    assert.equal(denied.status, 403, path);
    const allowed = await routeRequest(approverRequest("GET", path));
    assert.equal(allowed.status, 200, path);
  }
});

test("planners and approvers do not see inactive employees, admins do", async () => {
  // ROEPER ohne admin-Rolle: nur aktive Mitarbeiter, ohne Details.
  const roeper = masterData.employees.find((item) => item.extNr === "ROEPER");
  roeper.roles = ["user", "approver", "planner"];
  const scoped = await routeRequest(approverRequest("GET", "/odata/Employees"));
  const scopedBody = JSON.parse(scoped.body).value;
  assert.equal(scoped.status, 200);
  assert.deepEqual(scopedBody.map((item) => item.extNr).sort(), [
    "KRAUSE",
    "ROEPER",
    "SCHILZ",
    "WEBER",
  ]);
  assert.ok(!scopedBody.some((item) => item.extNr === "ALTMANN"));
  assert.ok(scopedBody.every((item) => item.aadOid === undefined));
  assert.ok(scopedBody.every((item) => item.sapAccount === undefined));

  // Mit admin-Rolle: alle, inklusive inaktiver ALTMANN.
  roeper.roles = ["user", "approver", "planner", "admin"];
  const admin = await routeRequest(approverRequest("GET", "/odata/Employees"));
  const adminBody = JSON.parse(admin.body).value;
  assert.ok(adminBody.some((item) => item.extNr === "ALTMANN" && !item.active));
  assert.ok(adminBody.every((item) => "aadOid" in item));
});

test("own timesheets can be limited to a period and reject invalid periods", async () => {
  const inPeriod = await routeRequest(
    request("GET", "/odata/MyTimesheets?from=2026-04-13&to=2026-04-13"),
  );
  assert.equal(inPeriod.status, 200);
  assert.deepEqual(
    JSON.parse(inPeriod.body).value.map((day) => day.date),
    ["2026-04-13"],
  );

  const later = await routeRequest(
    request("GET", "/odata/MyTimesheets?from=2026-05-01"),
  );
  assert.deepEqual(JSON.parse(later.body).value, []);

  const all = JSON.parse(
    (await routeRequest(request("GET", "/odata/MyTimesheets"))).body,
  ).value;
  const until = JSON.parse(
    (await routeRequest(request("GET", "/odata/MyTimesheets?to=2026-04-12")))
      .body,
  ).value;
  assert.equal(until.length, all.length - 1);
  assert.ok(until.every((day) => day.date <= "2026-04-12"));

  for (const query of [
    "from=2026-04-31",
    "to=2026-4-1",
    "from=2026-04-20&to=2026-04-01",
  ]) {
    const response = await routeRequest(
      request("GET", `/odata/MyTimesheets?${query}`),
    );
    assert.equal(response.status, 400, query);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "INVALID_TIMESHEET_PERIOD");
    assert.match(body.message, /Zeitraum/);
  }
});

async function withToday(today, work) {
  const before = process.env.XTS_TODAY;
  process.env.XTS_TODAY = today;
  try {
    return await work();
  } finally {
    if (before === undefined) delete process.env.XTS_TODAY;
    else process.env.XTS_TODAY = before;
  }
}

function dayOn(date) {
  return {
    extNr: "SCHILZ",
    date,
    startTime: "08:00",
    endTime: "12:00",
    breakMinutes: 0,
    location: "remote",
    status: "E",
    lines: [{ coIdent: "700000000004", description: "Fenster", hours: 4 }],
  };
}

test("timesheet dates are limited to the current and previous month until closing day", async () => {
  await withToday("2026-05-05", async () => {
    const profile = JSON.parse(
      (await routeRequest(request("GET", "/odata/MyProfile"))).body,
    );
    assert.equal(profile.today, "2026-05-05");
    assert.deepEqual(profile.timesheetWindow, {
      from: "2026-04-01",
      to: "2026-05-05",
    });

    for (const date of ["2026-04-01", "2026-04-30", "2026-05-05"]) {
      const ok = await routeRequest(
        request("POST", "/odata/TimesheetDays", dayOn(date)),
      );
      assert.equal(ok.status, 201, date);
    }
    for (const date of ["2026-03-31", "2026-05-06", "2027-01-01"]) {
      const blocked = await routeRequest(
        request("POST", "/odata/TimesheetDays", dayOn(date)),
      );
      assert.equal(blocked.status, 400, date);
      const body = JSON.parse(blocked.body);
      assert.equal(body.error, "DATE_OUT_OF_RANGE");
      assert.deepEqual(body.fields, ["date"]);
      assert.equal(body.problems[0].code, "DATE_OUT_OF_RANGE");
      assert.match(body.message, /01\.04\.2026 bis 05\.05\.2026/);
    }
    // Freigabe unterliegt derselben Regel.
    const submit = await routeRequest(
      request("POST", "/odata/TimesheetDays", {
        ...dayOn("2026-03-31"),
        status: "F",
      }),
    );
    assert.equal(JSON.parse(submit.body).error, "DATE_OUT_OF_RANGE");
  });

  // Ab dem Tag nach dem Monatsabschluss ist nur noch der laufende Monat offen.
  await withToday("2026-05-06", async () => {
    const profile = JSON.parse(
      (await routeRequest(request("GET", "/odata/MyProfile"))).body,
    );
    assert.deepEqual(profile.timesheetWindow, {
      from: "2026-05-01",
      to: "2026-05-06",
    });
    const april = await routeRequest(
      request("POST", "/odata/TimesheetDays", dayOn("2026-04-30")),
    );
    assert.equal(JSON.parse(april.body).error, "DATE_OUT_OF_RANGE");
  });
});

test("closing day rule is maintained by admins and drives the window", async () => {
  const invalid = await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 3,
      value: "31",
      active: true,
    }),
  );
  assert.equal(invalid.status, 400);

  const later = await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 3,
      value: "10",
      active: true,
    }),
  );
  assert.equal(later.status, 200);
  await withToday("2026-05-08", async () => {
    const profile = JSON.parse(
      (await routeRequest(request("GET", "/odata/MyProfile"))).body,
    );
    assert.equal(profile.timesheetWindow.from, "2026-04-01");
  });

  // Regel inaktiv: kein Monatsabschluss, der Vormonat bleibt offen.
  await routeRequest(
    approverRequest("POST", "/odata/Rules", {
      infotype: 3,
      value: "10",
      active: false,
    }),
  );
  await withToday("2026-05-31", async () => {
    const profile = JSON.parse(
      (await routeRequest(request("GET", "/odata/MyProfile"))).body,
    );
    assert.equal(profile.timesheetWindow.from, "2026-04-01");
  });

  const log = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", "/odata/AuditLog?category=rule"),
      )
    ).body,
  ).value;
  assert.ok(log.some((entry) => entry.objectKey === "Infotyp 3"));
});

const WEBER_UPN = "maria.weber@qualitytimes.de";
function weberRequest(method, url, body) {
  return request(method, url, body, { "x-mock-oauth-upn": WEBER_UPN });
}

test("cost object approvers are maintained by admins and validated", async () => {
  const list = await routeRequest(
    approverRequest("GET", "/odata/CostObjectApprovers"),
  );
  assert.equal(list.status, 200);
  const rows = JSON.parse(list.body).value;
  assert.equal(rows.length, 4);
  assert.equal(rows[3].displayName, "Maria Weber");
  assert.equal(rows[3].description, "SAP-Implementierung");
  assert.equal(rows[3].deputy, true);

  const own = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/CostObjectApprovers")))
      .body,
  ).value;
  assert.deepEqual(
    own.map((item) => item.id),
    ["000004"],
  );
  const user = await routeRequest(request("GET", "/odata/CostObjectApprovers"));
  assert.equal(user.status, 403);

  const missing = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "600000000001",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(missing.status, 400);
  assert.equal(JSON.parse(missing.body).error, "INVALID_COST_OBJECT_APPROVER");
  const notApprover = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "600000000001",
      extNr: "SCHILZ",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(notApprover.status, 409);
  assert.equal(JSON.parse(notApprover.body).error, "APPROVER_NOT_AVAILABLE");
  const overlap = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "700000000004",
      extNr: "WEBER",
      validFrom: "2026-06-01",
      validTo: "2026-06-30",
    }),
  );
  assert.equal(overlap.status, 409);
  assert.equal(JSON.parse(overlap.body).error, "APPROVER_OVERLAP");
  assert.equal(JSON.parse(overlap.body).conflictId, "000004");
  const nonAdmin = await routeRequest(
    weberRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "600000000001",
      extNr: "WEBER",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(nonAdmin.status, 403);

  const created = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "600000000001",
      extNr: "WEBER",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    }),
  );
  assert.equal(created.status, 200);
  assert.equal(JSON.parse(created.body).id, "000005");
  const log = JSON.parse(
    (
      await routeRequest(
        approverRequest("GET", "/odata/AuditLog?category=masterdata"),
      )
    ).body,
  ).value;
  assert.ok(log.some((entry) => entry.object === "Genehmigerzuordnung"));
});

test("approvers only see and decide days on their cost objects", async () => {
  // Gemischter Tag: eine Position auf Webers Kontierung, eine fremde.
  const mixed = await routeRequest(
    request("POST", "/odata/TimesheetDays", {
      extNr: "SCHILZ",
      date: "2026-04-03",
      startTime: "08:00",
      endTime: "14:30",
      breakMinutes: 30,
      location: "remote",
      status: "F",
      lines: [
        { coIdent: "700000000004", description: "Implementierung", hours: 4 },
        { coIdent: "600000000001", description: "Support", hours: 2 },
      ],
    }),
  );
  assert.equal(mixed.status, 201);

  const weber = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/ApprovalTimesheets"))).body,
  ).value;
  assert.deepEqual(
    weber.map((day) => `${day.extNr}/${day.date}`),
    ["SCHILZ/2026-04-03", "SCHILZ/2026-04-08"],
  );
  assert.deepEqual(weber[0].responsibleCoIdents, ["700000000004"]);
  assert.equal(weber[0].lines.length, 2, "alle Positionen bleiben sichtbar");

  const admin = JSON.parse(
    (await routeRequest(approverRequest("GET", "/odata/ApprovalTimesheets")))
      .body,
  ).value;
  assert.equal(admin.length, 4);
  const adminMixed = admin.find((day) => day.date === "2026-04-03");
  assert.deepEqual(adminMixed.responsibleCoIdents.sort(), [
    "600000000001",
    "700000000004",
  ]);

  const foreign = await routeRequest(
    weberRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "ROEPER",
      date: "2026-03-31",
      action: "approve",
    }),
  );
  assert.equal(foreign.status, 403);
  assert.equal(JSON.parse(foreign.body).error, "NOT_RESPONSIBLE");
  assert.match(JSON.parse(foreign.body).message, /zuständig/);

  const approved = await routeRequest(
    weberRequest("POST", "/odata/TimesheetApprovals", {
      extNr: "SCHILZ",
      date: "2026-04-03",
      action: "approve",
    }),
  );
  assert.equal(approved.status, 200);
  assert.equal(JSON.parse(approved.body).status, "G");

  // Zuordnung ausserhalb der Gueltigkeit zaehlt nicht.
  await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      id: "000004",
      coIdent: "700000000004",
      extNr: "WEBER",
      deputy: true,
      validFrom: "2026-05-01",
      validTo: "2026-12-31",
    }),
  );
  const afterChange = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/ApprovalTimesheets"))).body,
  ).value;
  assert.deepEqual(afterChange, []);
});

test("reporting is scoped for approvers and complete for controllers and admins", async () => {
  const budget = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/BudgetMonitor"))).body,
  ).value;
  assert.deepEqual(
    budget.map((row) => row.coIdent),
    ["700000000004"],
  );
  const quota = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/CostObjectQuota"))).body,
  ).value;
  assert.ok(quota.length > 0);
  assert.ok(quota.every((row) => row.coIdent === "700000000004"));
  const lifecycle = JSON.parse(
    (await routeRequest(weberRequest("GET", "/odata/ResourceLifecycle"))).body,
  ).value;
  assert.ok(lifecycle.length > 0);
  assert.ok(lifecycle.every((row) => row.coIdent === "700000000004"));

  const adminBudget = JSON.parse(
    (await routeRequest(approverRequest("GET", "/odata/BudgetMonitor"))).body,
  ).value;
  assert.ok(adminBudget.length > 1);

  // Controlling ohne Genehmigerrolle sieht alles, aber keine Genehmigungen.
  const weber = masterData.employees.find((item) => item.extNr === "WEBER");
  weber.roles = ["user", "controller"];
  const controller = await routeRequest(
    weberRequest("GET", "/odata/BudgetMonitor"),
  );
  assert.equal(controller.status, 200);
  assert.equal(JSON.parse(controller.body).value.length, adminBudget.length);
  const noApprovals = await routeRequest(
    weberRequest("GET", "/odata/ApprovalTimesheets"),
  );
  assert.equal(noApprovals.status, 403);
});

test("approver assignments reject invalid calendar days and stay deletable", async () => {
  for (const validFrom of ["2026-02-30", "2027-02-29", "2026-13-01"]) {
    const invalid = await routeRequest(
      approverRequest("POST", "/odata/CostObjectApprovers", {
        coIdent: "600000000001",
        extNr: "WEBER",
        validFrom,
        validTo: "2026-12-31",
      }),
    );
    assert.equal(invalid.status, 400, validFrom);
    assert.equal(
      JSON.parse(invalid.body).error,
      "INVALID_COST_OBJECT_APPROVER",
    );
  }
  const leap = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      coIdent: "600000000001",
      extNr: "WEBER",
      validFrom: "2028-02-29",
      validTo: "2028-12-31",
    }),
  );
  assert.equal(leap.status, 200);
  const invalidAssignment = await routeRequest(
    approverRequest("POST", "/odata/CostObjectAssignments", {
      extNr: "SCHILZ",
      coIdent: "600000000001",
      validFrom: "2027-02-29",
      validTo: "2027-12-31",
    }),
  );
  assert.equal(invalidAssignment.status, 400);

  // Genehmigerin deaktivieren: bestehende Zuordnung bleibt loeschbar.
  const weber = masterData.employees.find((item) => item.extNr === "WEBER");
  weber.active = false;
  const change = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      id: "000004",
      coIdent: "700000000004",
      extNr: "WEBER",
      deputy: true,
      validFrom: "2026-01-01",
      validTo: "2026-06-30",
    }),
  );
  assert.equal(change.status, 409);
  assert.equal(JSON.parse(change.body).error, "APPROVER_NOT_AVAILABLE");
  const removed = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      id: "000004",
      coIdent: "700000000004",
      extNr: "WEBER",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      deleted: true,
    }),
  );
  assert.equal(removed.status, 200);
  assert.equal(JSON.parse(removed.body).deleted, true);

  // Kontierung geloescht: Zuordnung bleibt loeschbar.
  await routeRequest(
    approverRequest("POST", "/odata/CostObjects", {
      coIdent: "600000000009",
      type: "PR",
      description: "Altprojekt Migration",
      active: true,
      deleted: true,
    }),
  );
  const removedCo = await routeRequest(
    approverRequest("POST", "/odata/CostObjectApprovers", {
      id: "000003",
      coIdent: "600000000009",
      extNr: "ROEPER",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      deleted: true,
    }),
  );
  assert.equal(removedCo.status, 200);
  const remaining = JSON.parse(
    (await routeRequest(approverRequest("GET", "/odata/CostObjectApprovers")))
      .body,
  ).value.map((item) => item.id);
  assert.ok(!remaining.includes("000003") && !remaining.includes("000004"));
});
