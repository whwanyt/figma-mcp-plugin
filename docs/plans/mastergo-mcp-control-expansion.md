# Figma MCP 全面控制扩展计划

## 背景

当前 MCP 服务已经打通 AI 到 Figma 插件的基础链路，但 operation 覆盖面仍然很窄。后续目标是让 AI 能稳定完成设计编辑、样式调整、文本处理、结构排版和导出，而不是只创建矩形和做少量属性更新。

## 策略

采用“分层工具优先”策略：先提供稳定、语义清晰、参数可校验的 MCP tools，再考虑受限低层 escape hatch。这样 AI 更容易正确调用，也更容易通过 Zod schema 在进入 Figma runtime 前拦住错误参数。

## Tool 可用性基线

- 所有 MCP tool description 都应包含面向 AI 的 `Input guidance`，不要只写一句基础描述。
- `packages/protocol` schema 需要通过 `.describe()` 暴露字段级约束，并对高频无歧义别名做归一化。
- 常见误传字段包括 `fills/strokes[].opacity`、`fills/strokes/effects[].visible`、节点 patch 的 `isVisible/isLocked`；兼容归一化后仍应在文档中推荐规范字段。
- `BAD_REQUEST.details.hints` 用于给 AI 返回可操作的修正建议，避免只暴露 Zod 的 `Unrecognized key`。
- `/capabilities` 必须同时暴露增强 description、`usageHints` 和 Figma API hints。

## Priority 0：稳定基础链路

- 保持现有 operation 可用：文档信息、选区、视口、节点读取、矩形创建、节点更新、节点删除。
- 固化 Figma raw `parent.postMessage(data, "*")` 消息协议。
- 保留 `fills.color.a` 默认值和插件端 `normalizeFills()` 兜底。
- 所有新增能力都必须通过 `vp check`、`vp test`、`vp run client#build`。

## Priority 1：节点创建、树查询和选择

- 新增节点创建：ellipse、line、text、frame、section、page。
- 新增树查询：当前页面节点树、按 id 读取子节点、按类型/名称查找节点。
- 新增选择控制：设置选区、清空选区、选择全部、按 id 选择节点。
- 涉及范围：`packages/protocol` schema、`packages/core` registry、`apps/client/lib/main.ts` dispatcher、`packages/figma-ops` hints。
- 当前实施批次采用以下边界：scene node 默认追加到当前页面；树查询默认 `maxDepth=2`，children 查询默认 `maxDepth=1`；查找默认限定当前页面；文本仅创建基础 `characters`，不处理字体和 range 样式。

## Priority 2：属性与样式控制

- 扩展节点更新字段：尺寸、位置、旋转、可见、锁定、透明度、圆角、填充、描边、效果。
- 扩展 paint schema：支持 `SOLID`、`GRADIENT_LINEAR/RADIAL/ANGULAR/DIAMOND` 和 `IMAGE` 占位字段，字段形状以 `@figma/plugin-typings` 的 `Paint` 为准。
- 增加批量更新 operation `figma.node.updateMany`，采用同一个 `patch` 更新多个 id，先校验全部节点存在再写入。
- 所有样式字段必须先确认 `@figma/plugin-typings` 类型，并在插件端归一化 Figma 特有默认值。
- 当前实施批次不包含 auto layout、layout grids、父子移动、文本 range 样式或导出能力；这些继续留在 Priority 3/4。
- 已补齐 tool 可用性优化：字段级说明、别名兼容、`BAD_REQUEST` hints、`usageHints` 和 `updateMany` 类型过滤提示。

## Priority 3：结构、层级与布局

- 新增 append、insert、move、reorder 等父子结构操作。
- 新增 group、union、subtract、intersect、exclude、flatten。
- 新增 frame/section layout 控制：auto layout、padding、spacing、clipsContent、layoutGrids。
- 对可能破坏图层结构的写操作增加更严格 schema 和更长 timeout。

## Priority 4：文本与资源

- 新增文本创建和更新：characters、字号、字体、对齐、行高、字距、局部 range 样式。
- 新增字体列表和字体加载能力，文本样式操作前必须处理字体可用性。
- 新增导出能力：节点 PNG/SVG、全局 PNG/SVG、从 SVG 创建节点。
- 异步导出和资源操作应使用更长 timeout，并返回可序列化结果。

## Priority 5：页面、样式库和高级能力

- 新增页面列表、创建页面、切换当前页面、页面背景设置。
- 新增样式读取、创建和应用能力：fill、text、effect、grid 等。
- 新增 pluginData/sharedPluginData，用于 AI 标记节点和复用上下文。
- 最后再设计受限低层 escape hatch，只允许白名单属性和白名单方法。

## 每批实施要求

- 先更新协议 schema 和 tests，再更新 core registry。
- 再更新插件主线程 dispatcher 和 Figma API 实现。
- 最后更新 capabilities hints 和对应架构文档。
- 每次新增或扩展 operation 都要同步更新 `usageHints` 和字段级 `.describe()`，保证 AI 不需要根据返回结构猜入参字段。
- 每批至少包含 schema 测试、core routing 测试和插件端手动验证路径。

## 非目标

- 不优先做任意 JavaScript 执行接口。
- 不优先做团队库、代码生成、复杂原型交互。
- 不绕过 `@figma/plugin-typings` 暴露未确认的 Figma API。
