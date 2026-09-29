# apps/server 架构

`apps/server` 是 MCP 服务进程。它同时暴露 MCP Streamable HTTP endpoint、调试 HTTP endpoint 和 Figma 插件 WebSocket bridge。

## 职责边界

- `src/index.ts` 组装 Node HTTP server、Hono app、MCP request handler 和 WebSocket bridge。
- `src/app.ts` 提供健康检查、session 列表、capabilities 和开发期 debug operation。
- `src/mcp.ts` 把 `packages/core` 的 operation registry 注册为 MCP tool，并使用 `packages/figma-ops` 生成面向 AI 的增强 tool description。
- `src/ws.ts` 接收 Figma 插件 UI 的 WebSocket 连接，并把插件 session 注册到 `FigmaKernel`。

## 数据流

1. MCP client 请求 `/mcp`。
2. `src/mcp.ts` 按 operation name 调用 `kernel.executeOperation()`。
3. `packages/core` 选择当前 active session，并通过 `src/ws.ts` 的 WebSocket send 函数下发 `operation.request`。
4. 插件 UI 回传 `operation.result` 或 `operation.error`。
5. `src/ws.ts` 根据 session id 和 request id 解析 pending request，返回 MCP tool result。

## HTTP 接口

- `GET /health`：返回服务状态和当前 session 数量。
- `GET /sessions`：返回当前已连接 Figma 插件 session 快照。
- `GET /capabilities`：返回 MCP operation 列表、增强 description、`usageHints` 和 Figma API hints。
- `POST /debug/operation`：开发期直接执行 operation，生产环境禁用。

## Tool 描述策略

- MCP tool description 必须包含 `Input guidance`，让 AI 在调用前看到当前页面范围、透明度字段、可见性字段和 `updateMany` 批量限制。
- Tool input schema 仍来自 `packages/protocol`；即使 schema 使用 transform/preprocess，`src/mcp.ts` 会解包出 object shape 暴露给 MCP SDK。
- `/capabilities.operations` 和 `/capabilities.figma` 都要携带 `usageHints`，避免 MCP client 与 HTTP debug 看到的提示不一致。

## 失败模式

- 无插件连接：`FigmaKernel` 返回 `NOT_CONNECTED`。
- 插件未响应：pending request 到期返回 `TIMEOUT`。
- WebSocket 断开：session 注销，pending request 统一返回 `TRANSPORT_ERROR`。
- 输入不符合协议 schema：`FigmaKernel` 返回 `BAD_REQUEST`，`details.hints` 会尽量提示常见字段修正，例如 `fills[].opacity` 应使用 `color.a`。
