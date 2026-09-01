import {
  costObjects,
  employees,
  enabledCostObjects,
  teams,
  timesheets,
} from "./fixtures.js";

const timesheetKey = (day) => `${day.extNr}|${day.date}`;

// Bis XTS-050 (AD/OAuth-Mapping) entschieden ist, simuliert die Mock-API
// feste Personas: employees[0] schreibt Stunden, employees[1] genehmigt.
const MOCK_USER = () => employees[0].extNr;
const MOCK_APPROVER = () => employees[1].extNr;

let timesheetStore = new Map();
let weDocumentCounter = 0;
resetTimesheetStore();

export function resetTimesheetStore() {
  timesheetStore = new Map(
    timesheets.map((day) => [timesheetKey(day), structuredClone(day)]),
  );
  weDocumentCounter = 0;
}

function displayNameFor(extNr) {
  return (
    employees.find((employee) => employee.extNr === extNr)?.displayName ?? extNr
  );
}

export async function routeRequest(request) {
  const url = new URL(request.url, "http://127.0.0.1");
  const path = url.pathname.replace(/\/$/, "");

  if (path === "/health") {
    return json({ status: "ok" });
  }

  if (request.method === "GET" && path === "/odata/Employees") {
    return json({ value: employees });
  }

  if (request.method === "GET" && path === "/odata/Teams") {
    return json({ value: teams });
  }

  if (request.method === "GET" && path === "/odata/CostObjects") {
    return json({ value: costObjects });
  }

  if (request.method === "GET" && path === "/odata/MyProfile") {
    return json(employees[0]);
  }

  if (request.method === "GET" && path === "/odata/MyEnabledCostObjects") {
    return json({ value: enabledCostObjects });
  }

  if (request.method === "GET" && path === "/odata/MyTimesheets") {
    const date = url.searchParams.get("date");
    const value = [...timesheetStore.values()]
      .filter((day) => day.extNr === MOCK_USER())
      .filter((day) => !date || day.date === date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return json({ value });
  }

  if (request.method === "GET" && path === "/odata/ApprovalTimesheets") {
    const month = url.searchParams.get("month");
    const extNr = url.searchParams.get("extNr");
    const value = [...timesheetStore.values()]
      .filter((day) => day.status === "F")
      .filter((day) => !month || day.date.startsWith(month))
      .filter((day) => !extNr || day.extNr === extNr)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.extNr.localeCompare(b.extNr),
      )
      .map((day) => ({ ...day, displayName: displayNameFor(day.extNr) }));
    return json({ value });
  }

  if (request.method === "POST" && path === "/odata/TimesheetApprovals") {
    const body = await readJsonBody(request);
    if (!body.extNr || !body.date || !body.action) {
      return json({ error: "extNr, date and action are required" }, 400);
    }
    const day = timesheetStore.get(timesheetKey(body));
    if (!day) {
      return json({ error: "Timesheet day not found" }, 404);
    }
    if (day.status !== "F") {
      return json(
        { error: "Only submitted days (status F) can be processed" },
        409,
      );
    }
    if (body.action === "approve") {
      day.status = "G";
      day.rejectionReason = undefined;
      day.approvedBy = MOCK_APPROVER();
      day.approvedAt = new Date().toISOString();
      weDocumentCounter += 1;
      day.weDocument = `WE-${String(weDocumentCounter).padStart(6, "0")}`;
      return json(structuredClone(day));
    }
    if (body.action === "reject") {
      if (!body.reason) {
        return json({ error: "reason is required for rejection" }, 400);
      }
      day.status = "A";
      day.rejectionReason = body.reason;
      day.approvedBy = undefined;
      day.approvedAt = undefined;
      return json(structuredClone(day));
    }
    return json({ error: "action must be approve or reject" }, 400);
  }

  if (request.method === "POST" && path === "/odata/TimesheetDays") {
    const body = await readJsonBody(request);
    if (!body.extNr || !body.date) {
      return json({ error: "extNr and date are required" }, 400);
    }
    const saved = structuredClone(body);
    timesheetStore.set(timesheetKey(saved), saved);
    return json(saved, 201);
  }

  return json({ error: "Not found", path }, 404);
}

export function json(payload, status = 200) {
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ),
  ).toString("utf8");
  return body ? JSON.parse(body) : {};
}
