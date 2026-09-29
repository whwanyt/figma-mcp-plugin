# packages/core 架构

`packages/core` 是协议无关的 operation 内核。它不关心 MCP HTTP 或 WebSocket 细节，只负责 operation 注册、输入校验、session 路由、request correlation 和超时处理。

## 职责边界

- `operationRegistry` 定义当前支持的 operation、读写模式、输入 schema 和 timeout。
- `FigmaKernel` 管理多个 Figma 插件 session，并选择 active session 执行 operation。
- `FigmaSession` 维护单个插件连接上的 pending request map，并用 request id 关联响应。
- 本包只依赖 `packages/protocol`，不直接依赖 Figma typings 或 MCP SDK。

## 执行流程

1. 调用方传入 operation name 和 raw input。
2. `FigmaKernel` 查找 operation definition。
3. 使用 operation input schema 校验并规范化输入。
4. 找到 active session 后调用 `FigmaSession.execute()`。
5. session 生成 request id，下发 `operation.request`，并创建 timeout。
6. WebSocket bridge 后续调用 `resolveOperation()` 或 `rejectOperation()` 完成 pending request。

## 错误模型

- `OPERATION_NOT_FOUND`：operation name 不在 registry。
- `BAD_REQUEST`：输入 schema 校验失败，`details` 包含 Zod flatten 结果和协议层生成的 `hints`。
- `NOT_CONNECTED`：没有 active Figma session。
- `TIMEOUT`：插件在 operation timeout 内没有返回。
- `TRANSPORT_ERROR`：发送失败或 session 断开。

## 扩展规则

- 新增 MCP 接口时必须先在 `packages/protocol` 定义 operation name 和输入 schema。
- 再在 `operationRegistry` 中声明描述、读写模式和 timeout。
- timeout 要按 Figma 操作成本设置：读操作短、创建/导出/异步资源操作长。
- 不在 core 层写 Figma API 细节，Figma API hints 由 `packages/figma-ops` 维护。
- Priority 1 的创建、页面和选择操作属于 `write`，树查询和节点查找属于 `read`。
- Priority 2 的 `node.update` 与 `node.updateMany` 都属于 `write`，共享同一套安全 patch schema 和 `8_000ms` timeout。
- `parseInput()` 必须把 operation name 传给协议层 hint helper，保证常见字段误用能返回明确修正建议。
- core registry 只保留基础 description；面向 AI 的增强 tool description 和 `usageHints` 由 `packages/figma-ops` 生成，避免 core 依赖 MCP 或 Figma metadata。
