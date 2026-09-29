import type { FigmaKernel } from "@figma-mcp/core";
import { ClientMessageSchema, parseJsonMessage, type ServerMessage } from "@figma-mcp/protocol";
import type { Server } from "node:http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";

// 挂载 Figma 插件专用 WebSocket bridge，负责把插件 UI 连接注册为 core session。
export function attachFigmaWebSocket(server: Server, kernel: FigmaKernel) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws/figma",
  });

  server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/ws/figma")) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      console.log(`[figma-ws] upgrade accepted: ${request.url}`);
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    let sessionId: string | undefined;
    console.log("[figma-ws] websocket connected");

    const send = (message: ServerMessage) => {
      console.log(`[figma-ws] send to plugin: ${message.type}`);
      ws.send(JSON.stringify(message));
    };

    ws.on("message", (data) => {
      const parsed = ClientMessageSchema.safeParse(readMessage(data));
      if (!parsed.success) {
        console.log("[figma-ws] invalid client message", parsed.error.flatten());
        sendError(ws, "BAD_REQUEST", "Invalid websocket message.", parsed.error.flatten());
        return;
      }

      const message = parsed.data;
      if (message.type === "hello") {
        if (sessionId) {
          console.log(`[figma-ws] replace session: ${sessionId}`);
          kernel.unregisterSession(sessionId);
        }

        const session = kernel.registerSession(message.session, { send });
        sessionId = session.id;
        console.log(
          `[figma-ws] hello received: session=${sessionId} plugin=${message.session.pluginId}`,
        );
        return;
      }

      if (!sessionId) {
        console.log(`[figma-ws] ${message.type} rejected: hello not received`);
        sendError(ws, "BAD_REQUEST", "Send hello before operation responses.");
        return;
      }

      if (message.type === "operation.result") {
        console.log(
          `[figma-ws] operation result: session=${sessionId} request=${message.requestId}`,
        );
        kernel.resolveOperation(sessionId, message.requestId, message.result);
        return;
      }

      console.log(
        `[figma-ws] operation error: session=${sessionId} request=${message.requestId} code=${message.error.code}`,
      );
      kernel.rejectOperation(sessionId, message.requestId, message.error);
    });

    ws.on("close", () => {
      console.log(`[figma-ws] websocket closed: session=${sessionId ?? "none"}`);
      if (sessionId) {
        kernel.unregisterSession(sessionId);
      }
    });
  });

  return wss;
}

// ws RawData 可能是 string、Buffer 或 Buffer[]；统一转成 JSON 值后交给协议 schema 校验。
function readMessage(data: RawData): unknown {
  const text =
    typeof data === "string"
      ? data
      : Array.isArray(data)
        ? Buffer.concat(data).toString("utf8")
        : Buffer.from(data as Uint8Array).toString("utf8");

  return parseJsonMessage(text);
}

// WebSocket 层只能返回 transport/protocol 错误；业务错误由插件主线程返回 operation.error。
function sendError(
  ws: WebSocket,
  code: "BAD_REQUEST" | "TRANSPORT_ERROR",
  message: string,
  details?: unknown,
) {
  ws.send(
    JSON.stringify({
      type: "operation.error",
      requestId: "unknown",
      error: { code, message, details },
    }),
  );
}
