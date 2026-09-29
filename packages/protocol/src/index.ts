import { z } from "zod";

type JsonRecord = Record<string, unknown>;

// 插件连接到服务端时上报的轻量元信息，用于 session 诊断和未来多文档路由。
export const SessionMetadataSchema = z.object({
  pluginId: z.string().min(1),
  pluginName: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  userAgent: z.string().min(1).optional(),
  connectedAt: z.string().datetime().optional(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

// Operation name 同时是 MCP tool 名称、core registry key 和插件 dispatcher key。
export const OperationNameSchema = z.enum([
  "figma.document.getInfo",
  "figma.selection.get",
  "figma.selection.set",
  "figma.selection.clear",
  "figma.selection.selectAll",
  "figma.viewport.get",
  "figma.viewport.set",
  "figma.document.getTree",
  "figma.node.get",
  "figma.node.getChildren",
  "figma.node.find",
  "figma.node.createRectangle",
  "figma.node.createEllipse",
  "figma.node.createLine",
  "figma.node.createText",
  "figma.node.createFrame",
  "figma.node.createSection",
  "figma.node.update",
  "figma.node.updateMany",
  "figma.node.delete",
  "figma.page.create",
]);

export type OperationName = z.infer<typeof OperationNameSchema>;

// 无输入 operation 使用严格空对象，防止 AI 传入未定义字段后被误认为有效参数。
export const EmptyInputSchema = z.object({}).strict().describe("No input. Pass an empty object.");

// 视口更新要求至少修改 center 或 zoom，避免空调用产生误导性的成功结果。
export const ViewportSetInputSchema = z
  .object({
    center: z
      .object({
        x: z.number().finite().describe("Viewport center x coordinate."),
        y: z.number().finite().describe("Viewport center y coordinate."),
      })
      .describe("New viewport center.")
      .optional(),
    zoom: z.number().positive().finite().describe("Positive viewport zoom value.").optional(),
  })
  .strict()
  .refine((value) => value.center !== undefined || value.zoom !== undefined, {
    message: "At least one of center or zoom is required.",
  })
  .describe("Update viewport center and/or zoom. At least one field is required.");

export const NodeGetInputSchema = z
  .object({
    id: z.string().min(1).describe("Figma node id."),
  })
  .strict()
  .describe("Read a node by id.");

export const TreeDepthSchema = z
  .number()
  .int()
  .min(0)
  .max(6)
  .describe("Maximum children depth to serialize. Must be 0-6.");

export const DocumentGetTreeInputSchema = z
  .object({
    maxDepth: TreeDepthSchema.default(2).describe("Defaults to 2. Maximum is 6."),
  })
  .strict()
  .describe("Read the current page tree. Does not search other pages.");

export const NodeGetChildrenInputSchema = z
  .object({
    id: z.string().min(1).describe("Container node id whose children should be read."),
    maxDepth: TreeDepthSchema.default(1).describe("Defaults to 1. Maximum is 6."),
  })
  .strict()
  .describe("Read a node's children up to a bounded depth.");

export const NodeTypeSchema = z.enum([
  "DOCUMENT",
  "PAGE",
  "GROUP",
  "FRAME",
  "RECTANGLE",
  "TEXT",
  "LINE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "BOOLEAN_OPERATION",
  "SLICE",
  "CONNECTOR",
  "SECTION",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "WIDGET",
  "EMBED",
  "LINK_UNFURL",
  "MEDIA",
  "HIGHLIGHT",
  "STAMP",
  "TABLE",
  "SLIDE",
  "SLIDE_ROW",
  "CODE_BLOCK",
  "WASHI_TAPE",
]);

export const NodeFindInputSchema = z
  .object({
    type: NodeTypeSchema.describe(
      "Optional node type filter. Search is current-page only.",
    ).optional(),
    nameContains: z
      .string()
      .min(1)
      .max(120)
      .describe("Case-insensitive name substring.")
      .optional(),
    maxResults: z.number().int().min(1).max(200).default(50).describe("Defaults to 50."),
  })
  .strict()
  .describe("Find nodes on the current page by type and/or name.");

export const BlendModeSchema = z.enum([
  "NORMAL",
  "DARKEN",
  "MULTIPLY",
  "COLOR_BURN",
  "LIGHTEN",
  "SCREEN",
  "COLOR_DODGE",
  "OVERLAY",
  "SOFT_LIGHT",
  "HARD_LIGHT",
  "DIFFERENCE",
  "EXCLUSION",
  "HUE",
  "SATURATION",
  "COLOR",
  "LUMINOSITY",
  "PLUS_DARKER",
  "PLUS_LIGHTER",
  "PASS_THROUGH",
]);

export const StrokeCapSchema = z.enum([
  "NONE",
  "ROUND",
  "SQUARE",
  "LINE_ARROW",
  "TRIANGLE_ARROW",
  "ROUND_ARROW",
  "RING",
  "DIAMOND",
  "LINE",
]);

export const StrokeJoinSchema = z.enum(["MITER", "BEVEL", "ROUND"]);
export const StrokeAlignSchema = z.enum(["CENTER", "INSIDE", "OUTSIDE"]);

// Figma paint colors do not carry separate paint opacity; default alpha keeps RGB-only input usable.
export const RgbaSchema = z
  .object({
    r: z.number().min(0).max(1).finite().describe("Red channel, 0-1."),
    g: z.number().min(0).max(1).finite().describe("Green channel, 0-1."),
    b: z.number().min(0).max(1).finite().describe("Blue channel, 0-1."),
    a: z
      .number()
      .min(0)
      .max(1)
      .finite()
      .default(1)
      .describe("Alpha channel, 0-1. Use this for SOLID paint transparency."),
  })
  .strict()
  .describe("RGBA color. Do not use opacity inside Paint; use color.a for SOLID paint.");

export const PointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

export const TransformRowSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

export const TransformSchema = z.tuple([TransformRowSchema, TransformRowSchema]).default([
  [1, 0, 0],
  [0, 1, 0],
]);

export const ColorStopSchema = z
  .object({
    position: z.number().min(0).max(1).finite().describe("Gradient stop position, 0-1."),
    color: RgbaSchema.describe("Gradient stop color. Use color.a for stop transparency."),
  })
  .strict();

export const ImageFiltersSchema = z
  .object({
    exposure: z.number().finite().optional(),
    contrast: z.number().finite().optional(),
    saturation: z.number().finite().optional(),
    temperature: z.number().finite().optional(),
    tint: z.number().finite().optional(),
    highlights: z.number().finite().optional(),
    shadows: z.number().finite().optional(),
    hue: z.number().finite().optional(),
  })
  .strict();

export const SolidPaintSchema = z
  .object({
    type: z.literal("SOLID"),
    color: RgbaSchema.describe("For fill/stroke transparency, use color.a. Do not use opacity."),
    visible: z
      .boolean()
      .describe("Paint visibility. isVisible is accepted as an alias.")
      .optional(),
    blendMode: BlendModeSchema.optional(),
  })
  .strict()
  .describe(
    "SOLID paint. Use color.a for transparency; opacity is accepted as compatibility input.",
  );

export const GradientPaintSchema = z
  .object({
    type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
    transform: TransformSchema,
    gradientStops: z.array(ColorStopSchema).min(2).describe("At least two gradient stops."),
    visible: z
      .boolean()
      .describe("Paint visibility. isVisible is accepted as an alias.")
      .optional(),
    blendMode: BlendModeSchema.optional(),
  })
  .strict()
  .describe("Gradient paint. Use gradientStops[].color.a for transparency.");

export const ImagePaintSchema = z
  .object({
    type: z.literal("IMAGE"),
    imageHash: z.string().min(1).describe("Figma image hash."),
    scaleMode: z.enum(["FILL", "TILE", "STRETCH", "FIT", "CROP"]).optional(),
    filters: ImageFiltersSchema.optional(),
    visible: z
      .boolean()
      .describe("Paint visibility. isVisible is accepted as an alias.")
      .optional(),
    blendMode: BlendModeSchema.optional(),
    rotation: z.number().finite().optional(),
  })
  .strict()
  .describe("Image paint. imageRef is accepted as a compatibility alias for imageHash.");

export const PaintSchema = z.preprocess(
  normalizePaintAliases,
  z.discriminatedUnion("type", [SolidPaintSchema, GradientPaintSchema, ImagePaintSchema]),
);

export const PluginGradientEffectSchema = z
  .object({
    mode: z.enum(["EVEN", "PROGRESSIVE"]).default("EVEN"),
    gradientStops: z
      .array(
        z
          .object({
            position: z.number().min(0).max(1).finite(),
            value: z.number().finite(),
          })
          .strict(),
      )
      .optional(),
    gradientHandlePositions: z.tuple([PointSchema, PointSchema]).optional(),
    transform: TransformSchema.optional(),
  })
  .strict();

export const ShadowEffectSchema = z
  .object({
    type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
    color: RgbaSchema.describe("Effect color. Use color.a for effect transparency."),
    offset: PointSchema.default({ x: 0, y: 0 }),
    spread: z.number().finite().default(0),
    radius: z.number().min(0).finite(),
    visible: z
      .boolean()
      .default(true)
      .describe("Effect visibility. isVisible is accepted as an alias."),
    blendMode: BlendModeSchema.default("NORMAL"),
  })
  .strict()
  .describe("Drop or inner shadow effect. visible is accepted as compatibility input.");

export const BlurEffectSchema = z
  .object({
    type: z.enum(["LAYER_BLUR", "BACKGROUND_BLUR"]),
    radius: z.number().min(0).finite(),
    visible: z
      .boolean()
      .default(true)
      .describe("Effect visibility. isVisible is accepted as an alias."),
  })
  .strict()
  .describe("Layer/background blur effect. visible is accepted as compatibility input.");

export const EffectSchema = z.preprocess(
  normalizeEffectAliases,
  z.discriminatedUnion("type", [ShadowEffectSchema, BlurEffectSchema]),
);

// 下列 operation input schema 会被 apps/server 转成 MCP tool input schema。
export const NodeCreateRectangleInputSchema = z
  .object({
    name: z.string().min(1).max(120).describe("Optional node name.").optional(),
    x: z.number().finite().describe("Node x position on the current page."),
    y: z.number().finite().describe("Node y position on the current page."),
    width: z.number().positive().finite().describe("Node width."),
    height: z.number().positive().finite().describe("Node height."),
    fills: z.array(PaintSchema).describe("Paint fills. Use color.a for transparency.").optional(),
  })
  .strict();

export const NodeCreateShapeInputSchema = z
  .object({
    name: z.string().min(1).max(120).describe("Optional node name.").optional(),
    x: z.number().finite().describe("Node x position on the current page."),
    y: z.number().finite().describe("Node y position on the current page."),
    width: z.number().positive().finite().describe("Node width."),
    height: z.number().positive().finite().describe("Node height."),
    fills: z.array(PaintSchema).describe("Paint fills. Use color.a for transparency.").optional(),
  })
  .strict();

export const NodeCreateLineInputSchema = z
  .object({
    name: z.string().min(1).max(120).describe("Optional node name.").optional(),
    x: z.number().finite().describe("Line x position on the current page."),
    y: z.number().finite().describe("Line y position on the current page."),
    width: z.number().positive().finite().describe("Line width."),
    height: z.number().finite().default(0).describe("Line height. Defaults to 0."),
  })
  .strict();

export const NodeCreateTextInputSchema = z
  .object({
    name: z.string().min(1).max(120).describe("Optional text node name.").optional(),
    x: z.number().finite().describe("Text x position on the current page."),
    y: z.number().finite().describe("Text y position on the current page."),
    characters: z.string().default("Text").describe("Text content. Defaults to Text."),
    width: z.number().positive().finite().describe("Optional text box width.").optional(),
    height: z.number().positive().finite().describe("Optional text box height.").optional(),
  })
  .strict();

const NodeUpdatePatchShape = {
  name: z.string().min(1).max(120).describe("Node name.").optional(),
  x: z.number().finite().describe("Node x position.").optional(),
  y: z.number().finite().describe("Node y position.").optional(),
  width: z.number().positive().finite().describe("Node width. Uses resize.").optional(),
  height: z.number().positive().finite().describe("Node height. Uses resize.").optional(),
  rotation: z.number().finite().describe("Rotation in degrees.").optional(),
  visible: z
    .boolean()
    .describe("Node visibility. isVisible is accepted as compatibility input.")
    .optional(),
  locked: z
    .boolean()
    .describe("Node lock state. isLocked is accepted as compatibility input.")
    .optional(),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .finite()
    .describe("Whole-node opacity, 0-1. Paint transparency belongs in color.a.")
    .optional(),
  cornerRadius: z
    .number()
    .min(0)
    .finite()
    .describe("Uniform corner radius. Not supported by every node type.")
    .optional(),
  topLeftRadius: z.number().min(0).finite().describe("Top-left corner radius.").optional(),
  topRightRadius: z.number().min(0).finite().describe("Top-right corner radius.").optional(),
  bottomLeftRadius: z.number().min(0).finite().describe("Bottom-left corner radius.").optional(),
  bottomRightRadius: z.number().min(0).finite().describe("Bottom-right corner radius.").optional(),
  fills: z
    .array(PaintSchema)
    .describe("Paint fills. Do not use fills[].opacity; use color.a.")
    .optional(),
  strokes: z
    .array(PaintSchema)
    .describe("Paint strokes. Do not use strokes[].opacity; use color.a.")
    .optional(),
  strokeWeight: z.number().min(0).finite().describe("Stroke weight.").optional(),
  strokeAlign: StrokeAlignSchema.optional(),
  strokeCap: StrokeCapSchema.optional(),
  strokeJoin: StrokeJoinSchema.optional(),
  strokeDashes: z.array(z.number().min(0).finite()).describe("Dash pattern lengths.").optional(),
  effects: z
    .array(EffectSchema)
    .describe("Effects. Use visible; isVisible is accepted as an alias.")
    .optional(),
  isVisible: z.boolean().describe("Compatibility alias for visible. Prefer visible.").optional(),
  isLocked: z.boolean().describe("Compatibility alias for locked. Prefer locked.").optional(),
} as const;

const hasEditablePatch = (patch: Record<string, unknown>) =>
  Object.values(patch).some((value) => value !== undefined);

export const NodeUpdatePatchSchema = z
  .object(NodeUpdatePatchShape)
  .strict()
  .transform(normalizeNodeUpdateAliases)
  .refine(hasEditablePatch, {
    message: "At least one editable field is required.",
  })
  .describe("Safe node patch. Do not infer fields from returned node objects.");

export const NodeUpdateInputSchema = z
  .object({
    id: z.string().min(1).describe("Node id to update."),
    ...NodeUpdatePatchShape,
  })
  .strict()
  .transform(normalizeNodeUpdateAliases)
  .refine(({ id: _id, ...patch }) => hasEditablePatch(patch), {
    message: "At least one editable field is required.",
  })
  .describe("Update safe editable properties of one node.");

export const NodeUpdateManyInputSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).describe("Node ids. All must exist."),
    patch: NodeUpdatePatchSchema.describe(
      "Same patch is applied to every node. Only include fields supported by all target node types.",
    ),
  })
  .strict()
  .describe("Batch update nodes atomically. Filter by node type before type-specific fields.");

export const NodeDeleteInputSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const SelectionSetInputSchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Node ids to select. Non-empty; use selection.clear to clear selection."),
  })
  .strict()
  .describe("Replace current page selection. Any missing id fails the operation.");

export const PageCreateInputSchema = z
  .object({
    name: z.string().min(1).max(120).describe("Optional page name.").optional(),
    makeCurrent: z
      .boolean()
      .default(false)
      .describe("Whether to switch to the new page. Defaults to false."),
  })
  .strict()
  .describe("Create a new page.");

export const OperationInputSchemas = {
  "figma.document.getInfo": EmptyInputSchema,
  "figma.selection.get": EmptyInputSchema,
  "figma.selection.set": SelectionSetInputSchema,
  "figma.selection.clear": EmptyInputSchema,
  "figma.selection.selectAll": EmptyInputSchema,
  "figma.viewport.get": EmptyInputSchema,
  "figma.viewport.set": ViewportSetInputSchema,
  "figma.document.getTree": DocumentGetTreeInputSchema,
  "figma.node.get": NodeGetInputSchema,
  "figma.node.getChildren": NodeGetChildrenInputSchema,
  "figma.node.find": NodeFindInputSchema,
  "figma.node.createRectangle": NodeCreateRectangleInputSchema,
  "figma.node.createEllipse": NodeCreateShapeInputSchema,
  "figma.node.createLine": NodeCreateLineInputSchema,
  "figma.node.createText": NodeCreateTextInputSchema,
  "figma.node.createFrame": NodeCreateShapeInputSchema,
  "figma.node.createSection": NodeCreateShapeInputSchema,
  "figma.node.update": NodeUpdateInputSchema,
  "figma.node.updateMany": NodeUpdateManyInputSchema,
  "figma.node.delete": NodeDeleteInputSchema,
  "figma.page.create": PageCreateInputSchema,
} as const satisfies Record<OperationName, z.ZodTypeAny>;

export type OperationInput<Name extends OperationName = OperationName> = z.infer<
  (typeof OperationInputSchemas)[Name]
>;

// HTTP debug endpoint 使用的请求 schema；MCP tool 调用由 SDK 按单个 operation schema 解析。
export const OperationRequestSchema = z.object({
  operation: OperationNameSchema,
  input: z.record(z.string(), z.unknown()).default({}),
});

export type OperationRequest = z.infer<typeof OperationRequestSchema>;

// 所有跨进程错误都收敛为 RpcError，确保 MCP、WebSocket 和插件 UI 能统一展示。
export const RpcErrorSchema = z.object({
  code: z.enum([
    "BAD_REQUEST",
    "NOT_CONNECTED",
    "OPERATION_NOT_FOUND",
    "OPERATION_FAILED",
    "TIMEOUT",
    "TRANSPORT_ERROR",
  ]),
  message: z.string(),
  details: z.unknown().optional(),
});

export type RpcError = z.infer<typeof RpcErrorSchema>;

// 插件 UI 发给服务端的 WebSocket 消息。
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    session: SessionMetadataSchema,
  }),
  z.object({
    type: z.literal("operation.result"),
    requestId: z.string().min(1),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal("operation.error"),
    requestId: z.string().min(1),
    error: RpcErrorSchema,
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// 服务端发给插件 UI 的 WebSocket 消息。
export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("operation.request"),
    requestId: z.string().min(1),
    operation: OperationNameSchema,
    input: z.unknown(),
  }),
  z.object({
    type: z.literal("ping"),
    requestId: z.string().min(1),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// 插件 UI 与插件主线程之间的消息，独立于 WebSocket 协议以便隔离 Figma runtime。
export const PluginBridgeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bridge.ready"),
    session: SessionMetadataSchema,
  }),
  z.object({
    type: z.literal("bridge.operation"),
    requestId: z.string().min(1),
    operation: OperationNameSchema,
    input: z.unknown(),
  }),
  z.object({
    type: z.literal("bridge.result"),
    requestId: z.string().min(1),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal("bridge.error"),
    requestId: z.string().min(1),
    error: RpcErrorSchema,
  }),
  z.object({
    type: z.literal("bridge.log"),
    message: z.string().min(1),
  }),
]);

export type PluginBridgeMessage = z.infer<typeof PluginBridgeMessageSchema>;

export type InputHint = {
  path: string;
  message: string;
};

export function getInputErrorHints(operation: OperationName, rawInput: unknown): InputHint[] {
  const hints = [] as InputHint[];
  const input = asRecord(rawInput);
  if (!input) {
    return hints;
  }

  collectPaintAliasHints(input.fills, "fills", hints);
  collectPaintAliasHints(input.strokes, "strokes", hints);
  collectEffectAliasHints(input.effects, "effects", hints);

  if (operation === "figma.node.update" || operation === "figma.node.updateMany") {
    const patch = operation === "figma.node.updateMany" ? asRecord(input.patch) : input;
    if (patch) {
      collectPaintAliasHints(patch.fills, "fills", hints);
      collectPaintAliasHints(patch.strokes, "strokes", hints);
      collectEffectAliasHints(patch.effects, "effects", hints);
      if ("isVisible" in patch) {
        hints.push({
          path: "isVisible",
          message:
            "Use visible for node visibility; isVisible is accepted as a compatibility alias.",
        });
      }
      if ("isLocked" in patch) {
        hints.push({
          path: "isLocked",
          message: "Use locked for node lock state; isLocked is accepted as a compatibility alias.",
        });
      }
      if (operation === "figma.node.updateMany" && hasTypeSpecificPatch(patch)) {
        hints.push({
          path: "patch",
          message:
            "updateMany is atomic and applies the same patch to every node; filter nodes by type before type-specific fields like cornerRadius, fills, strokes, or effects.",
        });
      }
    }
  }

  return dedupeHints(hints);
}

// 传输层先尽量解析 JSON；解析失败时保留原值，让上层 schema 产生明确错误。
export function parseJsonMessage(message: unknown): unknown {
  if (typeof message !== "string") {
    return message;
  }

  try {
    return JSON.parse(message) as unknown;
  } catch {
    return message;
  }
}

function normalizePaintAliases(value: unknown): unknown {
  const record = cloneRecord(value);
  if (!record) {
    return value;
  }

  if (record.visible !== undefined && record.isVisible === undefined) {
    record.visible = record.visible;
  }
  if (record.isVisible !== undefined && record.visible === undefined) {
    record.visible = record.isVisible;
  }
  delete record.isVisible;

  if (record.imageRef !== undefined && record.imageHash === undefined) {
    record.imageHash = record.imageRef;
  }
  delete record.imageRef;

  if (record.opacity !== undefined) {
    if (record.type === "SOLID") {
      const color = cloneRecord(record.color) ?? {};
      if (color.a === undefined) {
        color.a = record.opacity;
      }
      record.color = color;
    } else if (Array.isArray(record.gradientStops)) {
      record.gradientStops = record.gradientStops.map((stop) => {
        const stopRecord = cloneRecord(stop);
        if (!stopRecord) {
          return stop;
        }
        const color = cloneRecord(stopRecord.color) ?? {};
        if (color.a === undefined) {
          color.a = record.opacity;
        }
        return { ...stopRecord, color };
      });
    }
  }
  delete record.opacity;
  delete record.alpha;

  return record;
}

function normalizeEffectAliases(value: unknown): unknown {
  const record = cloneRecord(value);
  if (!record) {
    return value;
  }

  if (record.isVisible !== undefined && record.visible === undefined) {
    record.visible = record.isVisible;
  }
  delete record.isVisible;

  return record;
}

function normalizeNodeUpdateAliases(value: JsonRecord): JsonRecord {
  const normalized = { ...value };
  if (normalized.isVisible !== undefined && normalized.visible === undefined) {
    normalized.visible = normalized.isVisible;
  }
  if (normalized.isLocked !== undefined && normalized.locked === undefined) {
    normalized.locked = normalized.isLocked;
  }
  delete normalized.isVisible;
  delete normalized.isLocked;
  return normalized;
}

function cloneRecord(value: unknown): JsonRecord | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  return { ...record };
}

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonRecord;
}

function collectPaintAliasHints(value: unknown, path: string, hints: InputHint[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) {
      return;
    }
    if ("opacity" in record) {
      hints.push({
        path: `${path}[${index}].opacity`,
        message:
          record.type === "SOLID"
            ? `Use ${path}[${index}].color.a for SOLID paint transparency; opacity is accepted as a compatibility alias.`
            : `Use ${path}[${index}].gradientStops[].color.a for gradient transparency; opacity is accepted as a compatibility alias for gradients.`,
      });
    }
    if ("visible" in record) {
      hints.push({
        path: `${path}[${index}].visible`,
        message: `Use ${path}[${index}].visible for paint visibility; isVisible is accepted as a compatibility alias.`,
      });
    }
  });
}

function collectEffectAliasHints(value: unknown, path: string, hints: InputHint[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) {
      return;
    }
    if ("isVisible" in record) {
      hints.push({
        path: `${path}[${index}].isVisible`,
        message: `Use ${path}[${index}].visible for effect visibility; isVisible is accepted as a compatibility alias.`,
      });
    }
  });
}

function hasTypeSpecificPatch(patch: JsonRecord): boolean {
  return [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "fills",
    "strokes",
    "effects",
  ].some((key) => patch[key] !== undefined);
}

function dedupeHints(hints: InputHint[]): InputHint[] {
  const seen = new Set<string>();
  return hints.filter((hint) => {
    const key = `${hint.path}:${hint.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
