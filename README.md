<div align="center">

# Figma MCP Plugin

**面向 Figma 插件运行时的 Streamable HTTP MCP 桥接项目**

![Figma](https://img.shields.io/badge/Figma-Plugin-3662FF?style=for-the-badge)
![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-7C3AED?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite+](https://img.shields.io/badge/Toolchain-Vite%2B-16A34A?style=for-the-badge)
![Operations](https://img.shields.io/badge/Operations-21-F97316?style=for-the-badge)

</div>

`figma-mcp-plugin` 把外部 AI/MCP 客户端连接到 Figma 插件环境。服务端提供 MCP Streamable HTTP endpoint，Figma 插件 UI 通过 WebSocket 与服务端保持会话，插件主线程负责执行真实的 `figma` API 调用。

项目目标不是暴露一个任意 JavaScript 执行口，而是提供一组语义明确、参数可校验、对 AI 友好的 Figma 设计编辑工具：从读取文档和选择集，到创建节点、查询树、更新样式和批量修改，都有清晰的协议、错误模型和扩展边界。

## 亮点

| 领域               | 能力                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| **MCP 标准入口**   | 服务端暴露 `POST /mcp`，通过 MCP SDK 注册 operation 为 tools。                         |
| **Figma 插件桥接** | 插件 UI 维护 WebSocket，插件主线程独占 `figma` API 调用。                              |
| **强 schema 约束** | 使用 Zod 定义 operation 输入，进入 Figma runtime 前统一校验和归一化。                  |
| **AI 友好提示**    | Tool description 包含 `Input guidance`，`/capabilities` 返回 `usageHints`。            |
| **常见误传兼容**   | 兼容 `fills[].opacity`、`effects[].visible`、`isVisible/isLocked` 等高频别名。         |
| **可诊断错误**     | `BAD_REQUEST.details.hints` 会提示正确字段，运行时错误包含 request id 和节点类型线索。 |
| **Vite+ monorepo** | 使用 `vp check`、`vp test`、`vp run client#build` 完成统一验证。                       |

## 一览

| 项目                | 值                                        |
| ------------------- | ----------------------------------------- |
| 默认 MCP endpoint   | `http://localhost:8787/mcp`               |
| Figma WebSocket     | `ws://localhost:8787/ws/figma`            |
| 健康检查            | `http://localhost:8787/health`            |
| 能力查询            | `http://localhost:8787/capabilities`      |
| 当前 operation 数量 | `21`                                      |
| Figma typings       | `@figma/plugin-typings`                   |
| 插件 manifest       | `apps/client/manifest.json`               |
| 工具链              | Vite+ / TypeScript / Hono / Zod / MCP SDK |

## 工具领域

| 领域          | Operation                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `document`    | `figma.document.getInfo`、`figma.document.getTree`                                             |
| `viewport`    | `figma.viewport.get`、`figma.viewport.set`                                                     |
| `selection`   | `figma.selection.get`、`set`、`clear`、`selectAll`                                             |
| `node.read`   | `figma.node.get`、`getChildren`、`find`                                                        |
| `node.create` | `createRectangle`、`createEllipse`、`createLine`、`createText`、`createFrame`、`createSection` |
| `node.update` | `figma.node.update`、`figma.node.updateMany`                                                   |
| `node.delete` | `figma.node.delete`                                                                            |
| `page`        | `figma.page.create`                                                                            |

## 当前设计控制能力

| 能力     | 说明                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 节点创建 | 支持矩形、椭圆、线、文本、Frame、Section；scene node 默认追加到当前页面。 |
| 树查询   | 支持当前页面树、按 id 读取子节点、按名称/类型查找；深度最大 `6`。         |
| 选择控制 | 支持读取、替换、清空和全选当前页面选区。                                  |
| 基础样式 | 支持 `fills`、`strokes`、`effects`、透明度、圆角、描边参数。              |
| 几何属性 | 支持位置、尺寸、旋转、显隐、锁定和整体 opacity。                          |
| 批量更新 | `updateMany` 对多个 id 应用同一个 patch，并保持原子失败语义。             |

## 快速开始

```bash
vp install
vp check
vp test
vp run client#build
```

启动 MCP 服务端：

```bash
vp run server#dev
```

默认监听：

```text
MCP endpoint: http://localhost:8787/mcp
Figma websocket: ws://localhost:8787/ws/figma
```

## 在 Figma 中使用

1. 构建插件客户端：

```bash
vp run client#build
```

2. 将 `apps/client/dist` 中的产物与 `apps/client/manifest.json` 作为 Figma 插件加载。
3. 插件启动后会打开轻量诊断 UI。
4. UI 会连接 `ws://localhost:8787/ws/figma`，并向服务端注册当前插件 session。
5. MCP 客户端调用 `/mcp` 上的工具，服务端会通过 WebSocket 转发到插件主线程执行。

诊断 UI 主要用于确认：

| 状态                  | 用途                                      |
| --------------------- | ----------------------------------------- |
| `bridge.ready`        | 插件主线程已向 UI 上报 session metadata。 |
| WebSocket connected   | UI 已连接本地 MCP 服务端。                |
| `operation.request`   | 服务端已下发工具调用。                    |
| `bridge.result/error` | 插件主线程已完成或拒绝操作。              |

## MCP 客户端连接

健康检查：

```http
GET http://localhost:8787/health
```

能力查询：

```http
GET http://localhost:8787/capabilities
```

MCP endpoint：

```text
http://localhost:8787/mcp
```

开发期也可以绕过 MCP client 直接调试 operation：

```http
POST http://localhost:8787/debug/operation
Content-Type: application/json

{
  "operation": "figma.document.getInfo",
  "input": {}
}
```

`/debug/operation` 在生产环境会被禁用。

## 输入规则

MCP tool 的输入以 `packages/protocol` 中的 schema 为准，不要根据返回结构猜请求字段。

| 场景                | 正确写法                                        |
| ------------------- | ----------------------------------------------- |
| SOLID 填充透明度    | `fills[].color.a`                               |
| 渐变透明度          | `fills[].gradientStops[].color.a`               |
| 图片引用            | `fills[].imageHash`                             |
| 节点整体透明度      | `node.update` 顶层 `opacity`                    |
| paint/effect 可见性 | `visible`                                       |
| 清空选区            | `figma.selection.clear`                         |
| 批量圆角/填充/效果  | 先 `node.find` 按类型过滤，再 `node.updateMany` |

为了降低 AI 调用失败率，协议层会兼容以下无歧义别名：

| 兼容输入                                    | 归一化目标                                               |
| ------------------------------------------- | -------------------------------------------------------- |
| `fills[].opacity` / `strokes[].opacity`     | SOLID 映射到 `color.a`，渐变映射到每个 stop 的 `color.a` |
| `fills[].isVisible` / `strokes[].isVisible` | `visible`                                                |
| `effects[].isVisible`                       | `visible`                                                |
| `fills[].imageRef`                          | `imageHash`                                              |
| `node.update.isVisible`                     | `visible`                                                |
| `node.update.isLocked`                      | `locked`                                                 |

兼容别名只是容错层，文档和 tool description 始终推荐规范字段。

## 错误模型

| code                  | 含义                                                           |
| --------------------- | -------------------------------------------------------------- |
| `BAD_REQUEST`         | 输入 schema 校验失败，`details.hints` 会尽量给出字段修正建议。 |
| `NOT_CONNECTED`       | 当前没有连接中的 Figma 插件 session。                          |
| `OPERATION_NOT_FOUND` | operation name 不在 registry。                                 |
| `OPERATION_FAILED`    | Figma runtime 执行失败，例如目标节点不支持某个属性。           |
| `TIMEOUT`             | 插件未在 operation timeout 内返回结果。                        |
| `TRANSPORT_ERROR`     | WebSocket 发送失败或 session 断开。                            |

示例：如果传入 `fills[].opacity` 且同时有其它未知字段导致校验失败，`BAD_REQUEST.details.hints` 会提示使用 `color.a`。

## 架构分层

```text
apps/server/src/index.ts
  -> HTTP server + Hono app + MCP handler + WebSocket bridge

apps/server/src/mcp.ts
  -> MCP tool registration + operation execution adapter

apps/server/src/ws.ts
  -> Figma plugin session registration + request/response routing

apps/client/lib/main.ts
  -> Figma plugin main thread + figma API dispatcher

apps/client/ui/main.ts
  -> Plugin iframe UI + WebSocket client + diagnostic logs

packages/protocol
  -> Operation names + Zod input schemas + message schemas + input hints

packages/core
  -> Operation registry + session lifecycle + timeout + error model

packages/figma-ops
  -> Figma API hints + usageHints + AI-facing tool descriptions
```

关键约束：

- 插件主线程是唯一可以直接调用 `figma` API 的边界。
- UI iframe 只负责 WebSocket 和消息转发，不直接访问 `figma`。
- 服务端不直接调用 Figma runtime，只通过 active session 下发 `operation.request`。
- 协议层不依赖 Figma runtime，也不依赖 MCP SDK。
- 所有新增 operation 必须同步更新 schema、core registry、client dispatcher、usage hints 和测试。

## 扩展工具

1. 在 `packages/protocol` 增加 operation name 和 input schema。
2. 在 `packages/core` 的 `operationRegistry` 声明 mode、description 和 timeout。
3. 在 `apps/client/lib/main.ts` 增加 dispatcher 分支和 Figma API 实现。
4. 在 `packages/figma-ops` 增加 `figmaApiHints`、`usageHints` 和必要的 tool guidance。
5. 如果涉及常见误传字段，在协议层补充归一化和 `getInputErrorHints()`。
6. 更新架构文档或扩展计划。
7. 添加 schema、routing、capabilities 或插件侧行为测试。
8. 运行 `vp check`、`vp test`、`vp run client#build`。

新增能力必须以当前 `@figma/plugin-typings` 为准。尚未验证的字段不要暴露给 AI；能力不完整时宁可返回明确错误，也不要返回假成功。

## 项目脚本

| 命令                               | 说明                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `vp install`                       | 安装 workspace 依赖。                                 |
| `vp check`                         | 格式、lint 和类型检查。                               |
| `vp test`                          | 运行所有测试。                                        |
| `vp run client#build`              | 构建 Figma 插件 UI 和主线程 bundle。                  |
| `vp run server#dev`                | 启动 MCP 服务端。                                     |
| `vp run figma-ops#inspect:typings` | 检查当前 `@figma/plugin-typings` 暴露的 `figma` API。 |

## 文档

| 文档                                                          | 说明                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [apps/client 架构](apps/client/docs/architecture.md)          | 插件主线程、UI iframe、WebSocket 和消息桥。                 |
| [apps/server 架构](apps/server/docs/architecture.md)          | Hono、MCP endpoint、debug endpoint 和 WebSocket bridge。    |
| [protocol 架构](packages/protocol/docs/architecture.md)       | operation schema、别名归一化和跨进程消息协议。              |
| [core 架构](packages/core/docs/architecture.md)               | operation registry、session routing、timeout 和错误模型。   |
| [figma-ops 架构](packages/figma-ops/docs/architecture.md)     | Figma typings 对照、capabilities metadata 和 `usageHints`。 |
| [控制能力扩展计划](docs/plans/figma-mcp-control-expansion.md) | Priority 0-5 的能力扩展顺序。                               |

## 开发约定

- 使用 strict TypeScript 和 Vite+ 工具链。
- 使用 `rg` / `rg --files` 做代码检索。
- 修改协议、registry、dispatcher 或 tool metadata 后必须补测试。
- 不新增任意 API 调用型低层 escape hatch，除非后续有明确白名单设计。
- 不使用未在 `@figma/plugin-typings` 中确认的 Figma API。
- 保留 Figma raw `parent.postMessage(data, "*")` 协议，不退回 Figma 风格 `pluginMessage` 包装。
