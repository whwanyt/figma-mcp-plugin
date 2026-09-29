# packages/figma-ops 架构

`packages/figma-ops` 维护 MCP operation 与 Figma API surface 的对照信息，并生成面向 AI 的 tool description 与 `usageHints`。

## 职责边界

- `src/index.ts` 把 `packages/core` 的 operation registry 映射为 capabilities metadata。
- `figmaApiSurface` 记录每个 operation 依赖的 Figma API 名称。
- `getUsageHints()` 返回通用提示和 operation 专属提示，供 MCP tool 和 `/capabilities` 复用。
- `getToolDescription()` 把 core 的基础描述扩展为包含 `Input guidance` 的 MCP tool description。
- `scripts/inspect-typings.ts` 用于检查 `@figma/plugin-typings`，辅助扩展 operation 时确认 API 是否存在。
- 本包不执行 operation，也不参与 WebSocket 或 MCP request 生命周期；它只维护 metadata 和调用提示。

## 维护规则

- API hints 必须以当前 `@figma/plugin-typings` 为准，例如当前页面使用 `figma.currentPage`。
- 新增 operation 时必须同步增加 `figmaApiHints` 和 `usageHints`，除非该 operation 不直接调用 Figma API。
- usage hints 必须前置说明容易误传的字段，例如 paint 透明度、effect 可见性和 `updateMany` 类型过滤。
- hints 只用于开发、诊断和 AI 调用引导，不作为运行时权限控制。

## 扩展方向

- Priority 1：补齐常见节点创建、选择和树查询的 hints。
- Priority 2：补齐节点样式和批量更新 hints，尤其是 `color.a`、`isVisible` 和原子批量更新规则。
- Priority 3：补齐结构、布局、导入导出、页面、样式库、插件数据相关 hints。

## 失败模式

- hints 过期不会直接导致运行失败，但会误导 AI 和开发者排查问题。
- 当 typings 升级后，应优先运行检查脚本并更新本包文档与 metadata。
- 如果 operation schema 支持别名兼容，usage hints 仍应推荐规范字段，而不是鼓励长期依赖兼容别名。
