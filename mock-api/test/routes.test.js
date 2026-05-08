import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { routeRequest } from "../src/routes.js";

function request(method, url, body) {
  const stream = Readable.from(body ? [JSON.stringify(body)] : []);
  stream.method = method;
  stream.url = url;
  return stream;
}

test("returns employee profile", async () => {
  const response = await routeRequest(request("GET", "/odata/MyProfile"));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).extNr, "SCHILZ");
});

test("returns enabled cost objects", async () => {
  const response = await routeRequest(request("GET", "/odata/MyEnabledCostObjects?date=2026-04-13"));
  const body = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(body.value.length, 2);
  assert.equal(body.value[0].coIdent, "700000000004");
});

test("echoes saved timesheet draft", async () => {
  const draft = {
    extNr: "SCHILZ",
    date: "2026-04-13",
    status: "F",
    lines: []
  };
  const response = await routeRequest(request("POST", "/odata/TimesheetDays", draft));
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(response.body), draft);
});

