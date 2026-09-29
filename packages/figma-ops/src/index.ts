import { operationRegistry } from "@figma-mcp/core";
import type { OperationName } from "@figma-mcp/protocol";

export type FigmaApiSurface = {
  operation: OperationName;
  figmaApiHints: string[];
  usageHints: string[];
};

const commonUsageHints = [
  "Use only documented input fields; do not infer request fields from returned node objects.",
  "Current-page operations only affect figma.currentPage unless the tool says otherwise.",
  "Paint transparency uses color.a on paint colors.",
  "Use visible inside fills, strokes, and effects; isVisible is accepted as a compatibility alias.",
];

// 这里的 hints 只做能力说明和调试辅助，真实输入约束仍以 protocol schema 为准。
export const figmaApiSurface = [
  {
    operation: "figma.document.getInfo",
    figmaApiHints: ["figma.root", "figma.currentPage", "figma.apiVersion"],
    usageHints: ["Read-only tool. Use currentPage.id from the result for follow-up operations."],
  },
  {
    operation: "figma.selection.get",
    figmaApiHints: ["figma.currentPage.selection"],
    usageHints: ["Read-only tool. Returns serialized selected nodes on the current page."],
  },
  {
    operation: "figma.selection.set",
    figmaApiHints: ["figma.getNodeByIdAsync", "figma.currentPage.selection"],
    usageHints: [
      "ids must be non-empty.",
      "Any missing id fails the whole operation; use node.find or document.getTree first.",
    ],
  },
  {
    operation: "figma.selection.clear",
    figmaApiHints: ["figma.currentPage.selection"],
    usageHints: [
      "Pass an empty object. Use this instead of selection.set with an empty ids array.",
    ],
  },
  {
    operation: "figma.selection.selectAll",
    figmaApiHints: ["figma.currentPage.selectAll"],
    usageHints: ["Pass an empty object. Selects all nodes on the current page only."],
  },
  {
    operation: "figma.viewport.get",
    figmaApiHints: ["figma.viewport.center", "figma.viewport.zoom"],
    usageHints: ["Read-only tool. Returns center and zoom."],
  },
  {
    operation: "figma.viewport.set",
    figmaApiHints: ["figma.viewport.center", "figma.viewport.zoom"],
    usageHints: ["Provide center and/or zoom. At least one field is required."],
  },
  {
    operation: "figma.document.getTree",
    figmaApiHints: ["figma.currentPage.children"],
    usageHints: [
      "Reads the current page tree only.",
      "maxDepth defaults to 2 and cannot exceed 6.",
    ],
  },
  {
    operation: "figma.node.get",
    figmaApiHints: ["figma.getNodeByIdAsync"],
    usageHints: [
      "Read one node by id. Use returned fields for inspection, not as a request schema.",
    ],
  },
  {
    operation: "figma.node.getChildren",
    figmaApiHints: ["figma.getNodeByIdAsync", "ChildrenMixin.children"],
    usageHints: [
      "Reads children for a node with children.",
      "maxDepth defaults to 1 and cannot exceed 6.",
    ],
  },
  {
    operation: "figma.node.find",
    figmaApiHints: ["figma.currentPage.findAll"],
    usageHints: [
      "Searches the current page only.",
      "Use type/nameContains to filter before updateMany with type-specific fields.",
    ],
  },
  {
    operation: "figma.node.createRectangle",
    figmaApiHints: ["figma.createRectangle", "figma.currentPage.appendChild"],
    usageHints: [
      "Creates on the current page.",
      "For fill transparency, use fills[].color.a, not fills[].opacity.",
    ],
  },
  {
    operation: "figma.node.createEllipse",
    figmaApiHints: ["figma.createEllipse", "figma.currentPage.appendChild"],
    usageHints: [
      "Creates on the current page.",
      "For fill transparency, use fills[].color.a, not fills[].opacity.",
    ],
  },
  {
    operation: "figma.node.createLine",
    figmaApiHints: ["figma.createLine", "figma.currentPage.appendChild"],
    usageHints: ["Creates on the current page.", "height defaults to 0."],
  },
  {
    operation: "figma.node.createText",
    figmaApiHints: ["figma.createText", "TextNode.characters"],
    usageHints: [
      "Creates basic text only.",
      "characters defaults to Text; font/range styles are not handled here.",
    ],
  },
  {
    operation: "figma.node.createFrame",
    figmaApiHints: ["figma.createFrame", "figma.currentPage.appendChild"],
    usageHints: [
      "Creates on the current page.",
      "For fill transparency, use fills[].color.a, not fills[].opacity.",
    ],
  },
  {
    operation: "figma.node.createSection",
    figmaApiHints: ["figma.createSection", "figma.currentPage.appendChild"],
    usageHints: [
      "Creates on the current page.",
      "For fill transparency, use fills[].color.a, not fills[].opacity.",
    ],
  },
  {
    operation: "figma.node.update",
    figmaApiHints: [
      "SceneNode.name",
      "LayoutMixin.x/y/rotation",
      "SceneNode.resize",
      "SceneNode.visible/locked",
      "BlendMixin.opacity/effects",
      "GeometryMixin.fills/strokes/strokeWeight",
      "CornerMixin.cornerRadius",
    ],
    usageHints: [
      "Whole-node transparency uses top-level opacity.",
      "Paint transparency uses color.a on fill, stroke, gradient stop, or effect colors.",
      "Effects use visible; isVisible is accepted only as a compatibility alias.",
      "Some fields are node-type specific; unsupported fields return OPERATION_FAILED.",
    ],
  },
  {
    operation: "figma.node.updateMany",
    figmaApiHints: [
      "figma.getNodeByIdAsync",
      "SceneNode.resize",
      "GeometryMixin.fills/strokes",
      "BlendMixin.opacity/effects",
    ],
    usageHints: [
      "Applies the same patch to every id and fails atomically.",
      "Before cornerRadius, fills, strokes, or effects, use node.find to filter compatible node types.",
      "Use color.a for paint transparency; do not infer request fields from returned objects.",
    ],
  },
  {
    operation: "figma.node.delete",
    figmaApiHints: ["SceneNode.remove"],
    usageHints: ["Deletes one node by id. Ensure the id is correct before calling."],
  },
  {
    operation: "figma.page.create",
    figmaApiHints: ["figma.createPage", "figma.currentPage"],
    usageHints: [
      "makeCurrent defaults to false.",
      "New pages do not receive scene nodes automatically unless made current.",
    ],
  },
] satisfies FigmaApiSurface[];

export function getUsageHints(operationName: OperationName): string[] {
  const entry = figmaApiSurface.find((surface) => surface.operation === operationName);
  return [...commonUsageHints, ...(entry?.usageHints ?? [])];
}

export function getToolDescription(operationName: OperationName, baseDescription: string): string {
  return [
    baseDescription,
    "",
    "Input guidance:",
    ...getUsageHints(operationName).map((hint) => `- ${hint}`),
  ].join("\n");
}

// /capabilities 使用该结构把 core operation 与 Figma API 对照信息一起暴露出去。
export const supportedFigmaOperations = operationRegistry.map((operation) => ({
  name: operation.name,
  description: getToolDescription(operation.name, operation.description),
  mode: operation.mode,
  timeoutMs: operation.timeoutMs,
  usageHints: getUsageHints(operation.name),
  figmaApiHints:
    figmaApiSurface.find((entry) => entry.operation === operation.name)?.figmaApiHints ?? [],
}));
