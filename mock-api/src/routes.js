import {
  costObjects,
  employees,
  enabledCostObjects,
  teams,
  timesheets,
} from "./fixtures.js";

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
    return json({ value: timesheets });
  }

  if (request.method === "POST" && path === "/odata/TimesheetDays") {
    const body = await readJsonBody(request);
    return json(body, 201);
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
