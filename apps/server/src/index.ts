import { FigmaKernel } from "@figma-mcp/core";
import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import { createHttpApp } from "./app.ts";
import { handleMcpNodeRequest } from "./mcp.ts";
import { attachFigmaWebSocket } from "./ws.ts";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const kernel = new FigmaKernel();
const app = createHttpApp(kernel);
const honoHandler = getRequestListener(app.fetch);

const server = createServer((request, response) => {
  if (request.url?.startsWith("/mcp")) {
    void handleMcpNodeRequest(kernel, request, response);
    return;
  }

  void honoHandler(request, response);
});

attachFigmaWebSocket(server, kernel);

server.listen(port);

console.log(`Figma MCP server listening on http://localhost:${port}`);
console.log(`MCP endpoint: http://localhost:${port}/mcp`);
console.log(`Figma websocket: ws://localhost:${port}/ws/figma`);
