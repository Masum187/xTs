import http from "node:http";

import { toODataV2 } from "./odata-v2.js";
import { InvalidJsonError, json, routeRequest } from "./routes.js";

const port = Number(process.env.PORT ?? 4010);
// Antwortform (Entscheidung 17): "mock" = `{ value }`/direkt, "v2" = SAP
// Gateway OData V2 (`d.results`, Decimal-Strings, `/Date()/`, V2-Fehler).
const flavor = process.env.XTS_ODATA === "v2" ? "v2" : "mock";
const pageSize = Number(process.env.XTS_ODATA_PAGE_SIZE ?? 0) || 0;

function send(response, request, result) {
  const shaped =
    flavor === "v2" ? toODataV2(result, request, { pageSize }) : result;
  response.writeHead(shaped.status, shaped.headers);
  response.end(shaped.body);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers":
        "content-type,authorization,x-mock-oauth-oid,x-mock-oauth-upn",
    });
    response.end();
    return;
  }

  try {
    send(response, request, await routeRequest(request));
  } catch (error) {
    if (error instanceof InvalidJsonError) {
      send(response, request, json({ error: "INVALID_JSON" }, 400));
      return;
    }
    send(
      response,
      request,
      json(
        {
          error: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      ),
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  const shape = flavor === "v2" ? " (OData V2 shape)" : "";
  console.log(`xTS mock API${shape} listening on http://127.0.0.1:${port}`);
});
