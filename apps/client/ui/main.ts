import "./style.css";
import {
  PluginBridgeMessageSchema,
  ServerMessageSchema,
  type ClientMessage,
  type PluginBridgeMessage,
} from "@figma-mcp/protocol";
import { sendMsgToPlugin } from "../messages/sender.ts";

const serverUrl = "ws://localhost:8787/ws/figma";

let socket: WebSocket | undefined;
let session: Extract<PluginBridgeMessage, { type: "bridge.ready" }>["session"] | undefined;
const pendingOperations = new Map<string, PluginBridgeMessage>();
const logs: string[] = [];
const statusLine = document.querySelector<HTMLParagraphElement>("#bridge-status");
const sessionLine = document.querySelector<HTMLParagraphElement>("#bridge-session");
const pendingLine = document.querySelector<HTMLParagraphElement>("#bridge-pending");
const logItems = Array.from(document.querySelectorAll<HTMLLIElement>("#bridge-logs > li"));

connect();

// UI iframe 同时接收插件主线程 bridge 消息和浏览器 message 事件，因此先统一按协议 schema 解析。
window.addEventListener("message", (event) => {
  const rawMessage = event.data?.pluginMessage ?? event.data;
  const parsed = PluginBridgeMessageSchema.safeParse(rawMessage);
  if (!parsed.success) {
    addLog("ignored invalid plugin message");
    return;
  }

  if (parsed.data.type === "bridge.ready") {
    session = parsed.data.session;
    addLog(`plugin ready: ${session.pluginId}`);
    sendHello();
    return;
  }

  if (parsed.data.type === "bridge.result") {
    pendingOperations.delete(parsed.data.requestId);
    addLog(`operation result from plugin: ${parsed.data.requestId}`);
    sendToServer({
      type: "operation.result",
      requestId: parsed.data.requestId,
      result: parsed.data.result,
    });
    return;
  }

  if (parsed.data.type === "bridge.error") {
    pendingOperations.delete(parsed.data.requestId);
    addLog(`operation error from plugin: ${parsed.data.requestId} ${parsed.data.error.message}`);
    sendToServer({
      type: "operation.error",
      requestId: parsed.data.requestId,
      error: parsed.data.error,
    });
    return;
  }

  if (parsed.data.type === "bridge.log") {
    addLog(`plugin main: ${parsed.data.message}`);
  }
});

// 建立到 MCP 服务端的 WebSocket；断开后自动重连，session 信息会在 open 时重发 hello。
function connect() {
  addLog(`connecting websocket: ${serverUrl}`);
  socket = new WebSocket(serverUrl);

  socket.addEventListener("open", () => {
    addLog("websocket open");
    renderStatus("connected");
    sendHello();
  });

  socket.addEventListener("close", (event) => {
    addLog(`websocket closed: code=${event.code} reason=${event.reason || "none"}`);
    renderStatus("disconnected");
    window.setTimeout(connect, 2_000);
  });

  socket.addEventListener("error", () => {
    addLog("websocket error");
    renderStatus("error");
  });

  socket.addEventListener("message", (event) => {
    const parsed = ServerMessageSchema.safeParse(JSON.parse(String(event.data)));
    if (!parsed.success) {
      addLog("ignored invalid server message");
      return;
    }

    if (parsed.data.type === "operation.request") {
      addLog(`operation request from server: ${parsed.data.operation} ${parsed.data.requestId}`);
      const bridgeMessage: PluginBridgeMessage = {
        type: "bridge.operation",
        requestId: parsed.data.requestId,
        operation: parsed.data.operation,
        input: parsed.data.input,
      };
      pendingOperations.set(parsed.data.requestId, bridgeMessage);
      sendMsgToPlugin(bridgeMessage);
      addLog(`forwarded to plugin main: ${parsed.data.requestId}`);
    }
  });
}

// UI 到服务端的唯一发送入口；socket 未打开时只记录日志，不丢出未捕获异常。
function sendToServer(message: ClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) {
    addLog(`skip send ${message.type}: websocket not open`);
    return;
  }

  socket.send(JSON.stringify(message));
  addLog(`sent to server: ${message.type}`);
}

// bridge.ready 可能早于 WebSocket open，因此 hello 必须在两个时机都尝试发送。
function sendHello() {
  if (!session) {
    addLog("hello pending: plugin session not ready");
    return;
  }

  sendToServer({ type: "hello", session });
}

// 连接状态写入 body dataset，再由 render 同步到可见诊断 UI。
function renderStatus(status: "connected" | "disconnected" | "error") {
  document.body.dataset.connection = status;
  render();
}

// 保留最近 20 条桥接日志，帮助判断请求是否到达 UI、插件主线程或服务端。
function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift(`[${timestamp}] ${message}`);
  logs.splice(20);
  console.log(`[Figma MCP Bridge] ${message}`);
  render();
}

// 使用预渲染的固定 DOM 节点，避免每条日志都重建整个插件 UI。
function render() {
  const status = document.body.dataset.connection || "connecting";

  if (statusLine) {
    statusLine.textContent = `Status: ${status}`;
  }

  if (sessionLine) {
    sessionLine.textContent = `Session: ${session?.pluginId ?? "waiting for plugin ready"}`;
  }

  if (pendingLine) {
    pendingLine.textContent = `Pending operations: ${pendingOperations.size}`;
  }

  for (const [index, item] of logItems.entries()) {
    const log = logs[index];
    item.hidden = !log;
    item.textContent = log ?? "";
  }
}
