# apps/client 架构

`apps/client` 是运行在 Figma 插件环境里的桥接客户端。它负责把 MCP 服务端下发的操作转成 Figma 插件 API 调用，并把执行结果回传给服务端。

## 职责边界

- 插件主线程 `lib/main.ts` 持有 `figma` API 的访问权，所有实际修改画布的操作都必须在这里执行。
- UI iframe `ui/main.ts` 负责连接 `ws://localhost:8787/ws/figma`，维护连接状态，并转发服务端与插件主线程之间的消息。
- `messages/sender.ts` 封装 UI 与插件主线程的消息发送方式。Figma UI 发主线程必须使用裸消息 `parent.postMessage(data, "*")`，不能使用 Figma 风格的 `{ pluginMessage: data }` 包装。
- `index.html` 和 `ui/style.css` 只承载轻量诊断 UI，帮助开发者确认连接、会话和操作转发状态。

## 数据流

1. 插件主线程调用 `figma.showUI()` 打开 iframe。
2. 主线程向 UI 发送 `bridge.ready`，UI 记住 session metadata。
3. UI WebSocket 打开后向服务端发送 `hello`，服务端注册 Figma session。
4. 服务端发送 `operation.request`，UI 转成 `bridge.operation` 发给插件主线程。
5. 主线程按 operation 调用 Figma API，返回 `bridge.result` 或 `bridge.error`。
6. UI 把结果转成 `operation.result` 或 `operation.error` 发回服务端。

## Figma API 约束

- 访问当前页面必须使用 `figma.currentPage`，不要使用不存在于当前 typings 的 `figma.currentPage`。
- 读写节点优先使用 `figma.getNodeById`，必要时再通过 `figma.root.findOne` 兜底。
- 设置 `fills/strokes` 时必须满足 Figma `Paint` 类型要求。插件端会把缺失的 `color.a` 兜底补为 `1`，协议层限制 paint/effect 只能使用 typings 已声明字段。
- 主线程返回给 UI 的错误必须序列化为纯 JSON，避免 `Error` 对象跨消息桥失败。
- Priority 1 的新建 scene node 默认追加到当前页面；指定父容器、层级移动和结构重排属于后续结构控制能力。
- 树查询和查找默认只面向当前页面，避免 AI 在非当前页面上误操作。
- Priority 2 的 `node.updateMany` 先解析所有 id，再应用同一个 patch；单个节点不支持某属性时返回 `OPERATION_FAILED`，不静默忽略。
- `node.updateMany` 保持原子语义。遇到 `cornerRadius`、`fills`、`strokes`、`effects` 等节点类型不支持的字段时，主线程会返回带节点类型和 `node.find` 类型过滤建议的错误。
- 协议层已经兼容常见别名，主线程仍只接收规范化后的字段：paint 透明度落到 `color.a`，paint/effect 可见性落到 `isVisible`，节点显隐/锁定落到 `visible/locked`。

## 失败模式

- UI 未收到 `bridge.ready`：插件窗口会显示 `hello pending: plugin session not ready`。
- WebSocket 未连接：UI 会持续显示断连并重连。
- 主线程未收到操作：UI 会停在 `forwarded to plugin main`，服务端最终 `TIMEOUT`。
- Figma API 抛错：主线程返回 `OPERATION_FAILED`，UI 与服务端日志会包含失败操作和 request id；属性不支持错误会提示先过滤兼容节点类型。
