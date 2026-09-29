# packages/protocol 架构

`packages/protocol` 是跨进程、跨包共享的协议层。它定义 MCP operation 名称、输入 schema、错误结构，以及服务端和插件客户端之间的消息格式。

## 职责边界

- Operation name 是 MCP tool 名称、core registry 和插件 dispatcher 的共同枚举来源。
- Zod schema 是 MCP tool input 的公开约束，也是服务端执行前的输入校验入口。
- Client/Server/Bridge message schema 定义 WebSocket 和插件 iframe 消息桥的 wire shape。
- 本包不依赖 Figma runtime，也不直接调用 MCP SDK。

## 协议分组

- `SessionMetadataSchema`：插件连接时通过 `hello` 上报的 session 信息。
- `OperationInputSchemas`：每个 operation 的输入 schema，会被 `apps/server` 转成 MCP tool input schema。
- `getInputErrorHints()`：根据 operation 和 raw input 生成可读纠错提示，供 core 放入 `BAD_REQUEST.details.hints`。
- `RpcErrorSchema`：跨 MCP、WebSocket、插件桥传递的统一错误结构。
- `ClientMessageSchema`：插件 UI 发给服务端的 `hello`、`operation.result`、`operation.error`。
- `ServerMessageSchema`：服务端发给插件 UI 的 `operation.request`。
- `PluginBridgeMessageSchema`：插件 UI 与插件主线程之间的 `bridge.*` 消息。

## 类型约束

- `PaintSchema` 只暴露 `@figma/plugin-typings` 已声明的字段：`SOLID`、基础 `GRADIENT_*` 和 `IMAGE`，不接受任意 paint patch。
- `RgbaSchema.color.a` 默认值为 `1`，用于兼容 AI 常见的 `{ r, g, b }` 输入，同时满足 Figma `RGBA` 必填要求。
- `EffectSchema` 当前覆盖阴影和基础 blur；更复杂的低频效果必须先验证 typings 和插件端行为后再开放。
- `NodeUpdatePatchSchema` 是 `node.update` 和 `node.updateMany` 的共享 patch，确保单节点和批量更新字段完全一致。
- schema 使用 `.describe()` 给 MCP tool input 提供字段级说明，尤其是透明度、可见性、树深度、选择和批量更新字段。
- 协议层只兼容高频且无歧义的别名：`fills/strokes[].opacity` 映射到 `color.a`，`fills/strokes/effects[].visible` 映射到 `isVisible`，`isVisible/isLocked` 映射到节点 patch 的 `visible/locked`。
- 树查询 schema 必须限制 `maxDepth`，避免复杂文件一次返回过多节点。
- 选择控制 schema 要求 `selection.set` 的 id 数组非空，空选区必须使用 `selection.clear` 表达。
- 更新 schema 时必须同步更新 core registry、插件 dispatcher 和测试。

## 失败模式

- JSON 字符串解析失败时 `parseJsonMessage` 返回原始值，让上层 schema 产生可诊断的 invalid message。
- Operation input 不合法时由 core 返回 `BAD_REQUEST`，不要让无效 payload 进入 Figma 插件主线程。
- 对常见误传字段，即使最终仍因其他未知字段失败，也要通过 `details.hints` 告知推荐字段，减少 AI 反复猜测。
