type FigmaApi = typeof figma & Record<string, unknown>;
type JsonRecord = Record<string, unknown>;
type OperationName =
  | "figma.document.getInfo"
  | "figma.selection.get"
  | "figma.selection.set"
  | "figma.selection.clear"
  | "figma.selection.selectAll"
  | "figma.viewport.get"
  | "figma.viewport.set"
  | "figma.document.getTree"
  | "figma.node.get"
  | "figma.node.getChildren"
  | "figma.node.find"
  | "figma.node.createRectangle"
  | "figma.node.createEllipse"
  | "figma.node.createLine"
  | "figma.node.createText"
  | "figma.node.createFrame"
  | "figma.node.createSection"
  | "figma.node.update"
  | "figma.node.updateMany"
  | "figma.node.delete"
  | "figma.page.create";
type RpcError = {
  code: "OPERATION_FAILED";
  message: string;
  details?: unknown;
};
type PluginBridgeMessage =
  | {
      type: "bridge.ready";
      session: {
        pluginId: string;
        pluginName?: string;
        connectedAt?: string;
      };
    }
  | BridgeOperationMessage
  | {
      type: "bridge.result";
      requestId: string;
      result: unknown;
    }
  | {
      type: "bridge.error";
      requestId: string;
      error: RpcError;
    }
  | {
      type: "bridge.log";
      message: string;
    };
type BridgeOperationMessage = {
  type: "bridge.operation";
  requestId: string;
  operation: OperationName;
  input: unknown;
};
type SceneNodeFactoryName =
  | "createRectangle"
  | "createEllipse"
  | "createLine"
  | "createText"
  | "createFrame"
  | "createSection";
type NodeUpdatePatch = JsonRecord & {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
};

var api = figma as FigmaApi;

log("show UI");
figma.showUI(__html__, { width: 400, height: 350 });

log("send bridge.ready");
sendMsgToUI({
  type: "bridge.ready",
  session: {
    pluginId: "figma-mcp-client",
    pluginName: "Figma MCP Client",
    connectedAt: new Date().toISOString(),
  },
});

// Figma 会把 UI 发来的裸消息直接传给 onmessage；这里同时兼容旧的 pluginMessage 包装，方便排查历史构建。
(figma.ui as { onmessage?: (message: unknown) => void }).onmessage = function (rawMessage) {
  var message = unwrapBridgeMessage(rawMessage);
  if (!isBridgeOperationMessage(message)) {
    log("ignored non-operation message", rawMessage);
    return;
  }

  log(`received operation: ${message.operation} ${message.requestId}`);
  void handleBridgeOperation(message);
};

// 统一包住所有 Figma 操作，保证无论成功、失败还是异常对象不可序列化，都能回传一个 bridge 响应。
async function handleBridgeOperation(message: BridgeOperationMessage) {
  try {
    log(`operation start: ${message.operation} ${message.requestId}`);
    var result = await runFigmaOperation(message.operation, message.input);
    log(`operation succeeded: ${message.operation} ${message.requestId}`);
    sendMsgToUI({
      type: "bridge.result",
      requestId: message.requestId,
      result,
    });
  } catch (error) {
    log(`operation failed: ${message.operation} ${message.requestId}`, error);
    sendMsgToUI({
      type: "bridge.error",
      requestId: message.requestId,
      error: normalizeError(error),
    });
  }
}

// 插件主线程到 UI 的唯一发送入口；主线程拥有 figma.ui，UI iframe 不直接访问 figma。
function sendMsgToUI(message: PluginBridgeMessage): void {
  figma.ui.postMessage(message);
}

// 兼容旧版 Figma 风格包装；新代码必须发送 Figma 原生裸消息。
function unwrapBridgeMessage(message: unknown): unknown {
  if (!message || typeof message !== "object") {
    return message;
  }

  var record = message as { pluginMessage?: unknown };
  return record.pluginMessage || message;
}

// 同时输出到插件控制台和可见 UI，便于定位请求卡在 UI、WebSocket 还是 Figma API。
function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[Figma MCP Plugin] ${message}`);
  } else {
    console.log(`[Figma MCP Plugin] ${message}`, details);
  }

  try {
    figma.ui.postMessage({
      type: "bridge.log",
      message,
    });
  } catch {
    // UI logs are diagnostic only.
  }
}

// 这里只做最小结构判断，完整 operation/input 校验已经在 server protocol schema 层完成。
function isBridgeOperationMessage(message: unknown): message is BridgeOperationMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  var record = message as Partial<BridgeOperationMessage>;
  return (
    record.type === "bridge.operation" &&
    typeof record.requestId === "string" &&
    typeof record.operation === "string"
  );
}

// operation dispatcher 是协议名到 Figma API 实现的集中映射；新增 MCP 工具时必须同步扩展这里。
async function runFigmaOperation(operation: OperationName, input: unknown): Promise<unknown> {
  switch (operation) {
    case "figma.document.getInfo":
      return getDocumentInfo();
    case "figma.selection.get":
      return getSelection();
    case "figma.selection.set":
      return setSelection(input);
    case "figma.selection.clear":
      return clearSelection();
    case "figma.selection.selectAll":
      return selectAll();
    case "figma.viewport.get":
      return serializeViewport(getViewport());
    case "figma.viewport.set":
      return setViewport(input);
    case "figma.document.getTree":
      return getDocumentTree(input);
    case "figma.node.get":
      return getNode(input);
    case "figma.node.getChildren":
      return getNodeChildren(input);
    case "figma.node.find":
      return findNodes(input);
    case "figma.node.createRectangle":
      return createSceneNode("createRectangle", input);
    case "figma.node.createEllipse":
      return createSceneNode("createEllipse", input);
    case "figma.node.createLine":
      return createSceneNode("createLine", input);
    case "figma.node.createText":
      return createSceneNode("createText", input);
    case "figma.node.createFrame":
      return createSceneNode("createFrame", input);
    case "figma.node.createSection":
      return createSceneNode("createSection", input);
    case "figma.node.update":
      return updateNode(input);
    case "figma.node.updateMany":
      return updateManyNodes(input);
    case "figma.node.delete":
      return deleteNode(input);
    case "figma.page.create":
      return createPage(input);
  }
}

// 读取 Figma 文档基础信息。Figma Plugin API 以 figma.root/figma.currentPage 作为文档入口。
function getDocumentInfo(): JsonRecord {
  var document = figma.root;
  var currentPage = figma.currentPage;

  return {
    apiVersion: readProperty(api, "apiVersion"),
    documentId: readProperty(api, "documentId"),
    pluginId: readProperty(api, "pluginId"),
    mode: readProperty(api, "mode"),
    document: serializeNode(document),
    root: serializeNode(document),
    currentPage: serializeNode(currentPage),
  };
}

// 读取当前页面选区，返回经过裁剪的可序列化节点信息，避免把 Figma runtime 对象直接跨进程传递。
function getSelection(): unknown[] {
  var currentPage = figma.currentPage as unknown as JsonRecord;
  var selection = readProperty<unknown[]>(currentPage, "selection") || [];
  return selection.map(function (node) {
    return serializeNode(node);
  });
}

// selection.set 采用全量替换策略；任一 id 无效就失败，避免产生部分选中的模糊状态。
async function setSelection(input: unknown): Promise<unknown[]> {
  var ids = (input as { ids: string[] }).ids;
  var nodes = [] as JsonRecord[];
  for (var id of ids) {
    var node = await findNodeById(id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }
    nodes.push(node);
  }

  (figma.currentPage as unknown as JsonRecord).selection = nodes;
  return getSelection();
}

// 清空选区通过写入空数组完成，与 Figma PageNode.selection 类型保持一致。
function clearSelection(): unknown[] {
  (figma.currentPage as unknown as JsonRecord).selection = [];
  return getSelection();
}

// selectAll 直接调用 PageNode.selectAll，再返回序列化后的当前选区。
function selectAll(): unknown[] {
  figma.currentPage.selection = figma.currentPage.children.slice();
  return getSelection();
}

// 视口 API 位于 figma.viewport；这里保留动态读取，方便兼容 Figma runtime 的细微版本差异。
function getViewport(): JsonRecord {
  var viewport = readProperty<JsonRecord>(api, "viewport");
  if (!viewport) {
    return {};
  }

  return viewport;
}

// 更新视口中心点或缩放，输入已在服务端 schema 层保证至少包含一个字段。
function setViewport(input: unknown): JsonRecord {
  var viewport = getViewport();
  var payload = input as {
    center?: { x: number; y: number };
    zoom?: number;
  };

  if (payload.center) {
    viewport.center = payload.center;
  }

  if (payload.zoom !== undefined) {
    viewport.zoom = payload.zoom;
  }

  return serializeViewport(viewport);
}

// 按 id 读取节点并序列化；找不到节点时返回 undefined，由调用方决定如何展示。
async function getNode(input: unknown): Promise<unknown> {
  var id = (input as { id: string }).id;
  var node = await findNodeById(id);
  return serializeNode(node);
}

// 读取当前页面树，按 maxDepth 裁剪 children，避免复杂页面一次返回过多节点。
function getDocumentTree(input: unknown): unknown {
  var maxDepth = (input as { maxDepth: number }).maxDepth;
  return serializeNodeTree(figma.currentPage, maxDepth);
}

// 按 id 读取节点的子树；目标节点必须是支持 children 的容器节点。
async function getNodeChildren(input: unknown): Promise<unknown[]> {
  var payload = input as { id: string; maxDepth: number };
  var node = await findNodeById(payload.id);
  if (!node) {
    throw new Error(`Node not found: ${payload.id}`);
  }

  var children = readProperty<unknown[]>(node, "children") || [];
  return children.map(function (child) {
    return serializeNodeTree(child, payload.maxDepth);
  });
}

// 只在当前页面查找节点，避免跨页面结果让 AI 后续操作到非当前上下文。
function findNodes(input: unknown): unknown[] {
  var payload = input as {
    type?: string;
    nameContains?: string;
    maxResults: number;
  };
  var query = payload.nameContains?.toLowerCase();
  var nodes = figma.currentPage.findAll(function (node) {
    if (payload.type && node.type !== payload.type) {
      return false;
    }

    if (query && !node.name.toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });

  return nodes.slice(0, payload.maxResults).map(function (node) {
    return serializeNode(node);
  });
}

// 创建 scene node 并追加到当前页面；本批不支持直接指定父容器，父子移动留给 Priority 3。
async function createSceneNode(
  factoryName: SceneNodeFactoryName,
  input: unknown,
): Promise<unknown> {
  var payload = input as {
    name?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    characters?: string;
    fills?: unknown[];
  };
  var createNode = readFunction(api, factoryName);
  if (!createNode) {
    throw new Error(`figma.${factoryName} is not available.`);
  }

  var node = createNode.call(api) as JsonRecord;
  node.x = payload.x;
  node.y = payload.y;
  if (payload.name) {
    node.name = payload.name;
  }
  if (factoryName === "createText") {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    node.characters = payload.characters || "Text";
  }
  if (payload.fills) {
    node.fills = normalizeFills(payload.fills);
  }
  if (payload.width !== undefined || payload.height !== undefined) {
    resizeNode(
      node,
      payload.width !== undefined ? payload.width : readNumber(node, "width") || 1,
      payload.height !== undefined ? payload.height : readNumber(node, "height") || 0,
    );
  }

  var currentPage = figma.currentPage as unknown as JsonRecord;
  var appendChild = readFunction(currentPage, "appendChild");
  if (appendChild && readProperty(node, "parent") !== currentPage) {
    appendChild.call(currentPage, node);
  }

  return serializeNode(node);
}

// 创建页面默认不切换当前页面，除非调用方显式传 makeCurrent。
async function createPage(input: unknown): Promise<JsonRecord | undefined> {
  var payload = input as { name?: string; makeCurrent: boolean };
  var createPageFn = readFunction(api, "createPage");
  if (!createPageFn) {
    throw new Error("figma.createPage is not available.");
  }

  var page = createPageFn.call(api) as JsonRecord;
  if (payload.name) {
    page.name = payload.name;
  }
  if (payload.makeCurrent) {
    await figma.setCurrentPageAsync(page as unknown as PageNode);
  }

  return serializeNode(page);
}

// 更新节点的安全字段；高风险结构操作和复杂样式应拆成专用 operation，避免任意属性写入。
async function updateNode(input: unknown): Promise<unknown> {
  var payload = input as NodeUpdatePatch & { id: string };
  var node = await findNodeById(payload.id);
  if (!node) {
    throw new Error(`Node not found: ${payload.id}`);
  }

  applyNodePatch(node, payload);
  return serializeNode(node);
}

// 批量更新先完成所有 id 校验，再应用同一个 patch，避免部分节点已修改、后续节点找不到。
async function updateManyNodes(input: unknown): Promise<unknown[]> {
  var payload = input as { ids: string[]; patch: NodeUpdatePatch };
  var nodes = [] as JsonRecord[];
  for (var id of payload.ids) {
    var node = await findNodeById(id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }
    nodes.push(node);
  }

  return nodes.map(function (node) {
    applyNodePatch(node, payload.patch);
    return serializeNode(node);
  });
}

// node.update 的字段白名单在这里落到 Figma runtime；不支持的字段会显式失败而不是静默吞掉。
function applyNodePatch(node: JsonRecord, patch: NodeUpdatePatch): void {
  writeOptional(node, "name", patch.name);
  writeOptional(node, "x", patch.x);
  writeOptional(node, "y", patch.y);
  writeOptional(node, "rotation", patch.rotation);
  writeOptional(node, "opacity", patch.opacity);

  writeBooleanAlias(node, "visible", "isVisible", patch.visible);
  writeBooleanAlias(node, "locked", "isLocked", patch.locked);

  var cornerKeys = [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
  ] as const;
  for (var cornerKey of cornerKeys) {
    writeOptional(node, cornerKey, patch[cornerKey]);
  }

  var strokeKeys = [
    "strokeWeight",
    "strokeAlign",
    "strokeCap",
    "strokeJoin",
    "strokeDashes",
  ] as const;
  for (var strokeKey of strokeKeys) {
    writeOptional(node, strokeKey, patch[strokeKey]);
  }

  if (patch.fills !== undefined) {
    writeRequired(node, "fills", normalizeFills(patch.fills));
  }
  if (patch.strokes !== undefined) {
    writeRequired(node, "strokes", normalizeFills(patch.strokes));
  }
  if (patch.effects !== undefined) {
    writeRequired(node, "effects", patch.effects);
  }

  var width = readNumber(patch, "width");
  var height = readNumber(patch, "height");
  if (width !== undefined || height !== undefined) {
    resizeNode(
      node,
      width !== undefined ? width : readNumber(node, "width") || 1,
      height !== undefined ? height : readNumber(node, "height") || 1,
    );
  }
}

// 删除节点前先确认节点存在且支持 remove，避免把 Figma runtime 异常变成不可读错误。
async function deleteNode(input: unknown): Promise<JsonRecord> {
  var id = (input as { id: string }).id;
  var node = await findNodeById(id);
  if (!node) {
    throw new Error(`Node not found: ${id}`);
  }

  var remove = readFunction(node, "remove");
  if (!remove) {
    throw new Error(`Node cannot be removed: ${id}`);
  }

  remove.call(node);
  return { id, deleted: true };
}

// Figma typings 提供异步 getNodeByIdAsync；同步 getNodeById 只作为老运行时兜底。
async function findNodeById(id: string): Promise<JsonRecord | undefined> {
  var getNodeByIdAsync = readFunction(api, "getNodeByIdAsync");
  if (getNodeByIdAsync) {
    return (await getNodeByIdAsync.call(api, id)) as JsonRecord | undefined;
  }

  var getNodeById = readFunction(api, "getNodeById");
  if (getNodeById) {
    return getNodeById.call(api, id) as JsonRecord | undefined;
  }

  var findOne = readFunction(figma.root, "findOne");
  if (findOne) {
    return findOne.call(figma.root, function (node: unknown) {
      return readProperty(node, "id") === id;
    }) as JsonRecord | undefined;
  }

  throw new Error("Node lookup is not available in this Figma runtime.");
}

// 优先调用节点自身 resize 方法；如果运行时对象不提供 resize，则退回直接写 width/height。
function resizeNode(node: JsonRecord, width: number, height: number): void {
  var resize = readFunction(node, "resize");
  if (resize) {
    resize.call(node, width, height);
    return;
  }

  node.width = width;
  node.height = height;
}

// Figma RGBA 要求 color.a 必填；AI 常省略 alpha，因此插件端再兜底补 1。
function normalizeFills(fills: unknown): unknown {
  if (!Array.isArray(fills)) {
    return fills;
  }

  return fills.map(function (fill) {
    if (!fill || typeof fill !== "object") {
      return fill;
    }

    var record = fill as JsonRecord;
    if (record.type !== "SOLID") {
      return fill;
    }

    var color = readProperty<JsonRecord>(record, "color");
    if (!color || typeof color !== "object" || readProperty(color, "a") !== undefined) {
      return fill;
    }

    return {
      ...record,
      color: {
        ...color,
        a: 1,
      },
    };
  });
}

// 可选字段只在调用方传入时写入；字段不存在时失败，提示该节点类型不支持该属性。
function writeOptional(node: JsonRecord, property: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  writeRequired(node, property, value);
}

// 部分 UI 语义字段在 Figma typings 中带 is 前缀，对外保留更自然的 visible/locked。
function writeBooleanAlias(
  node: JsonRecord,
  runtimeProperty: string,
  publicProperty: string,
  value: boolean | undefined,
): void {
  if (value === undefined) {
    return;
  }

  if (runtimeProperty in node) {
    node[runtimeProperty] = value;
    return;
  }

  if (publicProperty in node) {
    node[publicProperty] = value;
    return;
  }

  throw new Error(`Node does not support property: ${publicProperty}`);
}

// 写入前检查属性是否存在，可以把“该节点不支持圆角/描边/效果”的问题变成明确 OPERATION_FAILED。
function writeRequired(node: JsonRecord, property: string, value: unknown): void {
  if (!(property in node)) {
    throw new Error(buildUnsupportedPropertyMessage(node, property));
  }

  node[property] = value;
}

// 属性支持与节点类型强相关；这里把运行时失败转成 AI 能继续修正的类型过滤建议。
function buildUnsupportedPropertyMessage(node: JsonRecord, property: string): string {
  var type = readProperty(node, "type");
  var typeLabel = typeof type === "string" ? type : "UNKNOWN";
  var typeSpecific = [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "fills",
    "strokes",
    "effects",
  ];
  var guidance = typeSpecific.includes(property)
    ? " Use figma.node.find to filter compatible node types before calling figma.node.updateMany."
    : "";
  return `Node type ${typeLabel} does not support property: ${property}.${guidance}`;
}

// 只返回可 JSON 序列化的视口字段，避免把 Figma viewport 对象整体传出。
function serializeViewport(viewport: JsonRecord): JsonRecord {
  return {
    center: readProperty(viewport, "center"),
    zoom: readProperty(viewport, "zoom"),
  };
}

// 节点序列化只暴露 AI 后续定位和修改所需的稳定字段。
function serializeNode(node: unknown): JsonRecord | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  var record = node as JsonRecord;
  return {
    id: readProperty(record, "id"),
    name: readProperty(record, "name"),
    type: readProperty(record, "type"),
    x: readProperty(record, "x"),
    y: readProperty(record, "y"),
    width: readProperty(record, "width"),
    height: readProperty(record, "height"),
    rotation: readProperty(record, "rotation"),
    opacity: readProperty(record, "opacity"),
    visible: readProperty(record, "visible") ?? readProperty(record, "isVisible"),
    locked: readProperty(record, "locked") ?? readProperty(record, "isLocked"),
    cornerRadius: readProperty(record, "cornerRadius"),
    fills: readProperty(record, "fills"),
    strokes: readProperty(record, "strokes"),
    strokeWeight: readProperty(record, "strokeWeight"),
    effects: readProperty(record, "effects"),
  };
}

// 树序列化在基础节点字段上追加 children；maxDepth=0 时只返回当前节点。
function serializeNodeTree(node: unknown, maxDepth: number): JsonRecord | undefined {
  var serialized = serializeNode(node);
  if (!serialized || maxDepth <= 0) {
    return serialized;
  }

  var children = readProperty<unknown[]>(node, "children");
  if (!children) {
    return serialized;
  }

  return {
    ...serialized,
    children: children.map(function (child) {
      return serializeNodeTree(child, maxDepth - 1);
    }),
  };
}

// 将任意 Figma runtime 异常归一化成协议允许的 OPERATION_FAILED。
function normalizeError(error: unknown): RpcError {
  return {
    code: "OPERATION_FAILED",
    message: error instanceof Error ? error.message : "Figma operation failed.",
    details: serializeError(error),
  };
}

// Error 对象不能可靠跨插件消息桥传输，因此先转成普通 JSON 结构。
function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (!error || typeof error !== "object") {
    return error;
  }

  try {
    return JSON.parse(JSON.stringify(error)) as unknown;
  } catch {
    return "Unserializable error object.";
  }
}

// 动态读取 Figma runtime 属性，隔离 unknown/object 判断。
function readProperty<T = unknown>(object: unknown, property: string): T | undefined {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  return (object as Record<string, T>)[property];
}

// 读取可选 number 字段，用于尺寸更新时区分 0、undefined 和非法值。
function readNumber(object: unknown, property: string): number | undefined {
  var value = readProperty(object, property);
  return typeof value === "number" ? value : undefined;
}

// 动态读取 Figma runtime 方法，避免对不同运行时版本做硬类型断言。
function readFunction(
  object: unknown,
  property: string,
): ((...args: unknown[]) => unknown) | undefined {
  var value = readProperty(object, property);
  return typeof value === "function" ? (value as (...args: unknown[]) => unknown) : undefined;
}
