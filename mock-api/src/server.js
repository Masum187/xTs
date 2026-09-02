import http from "node:http";

import { routeRequest } from "./routes.js";

const port = Number(process.env.PORT ?? 4010);

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
    const result = await routeRequest(request);
    response.writeHead(result.status, result.headers);
    response.end(result.body);
  } catch (error) {
    response.writeHead(500, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`xTS mock API listening on http://127.0.0.1:${port}`);
});
