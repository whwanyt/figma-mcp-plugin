import {
  getInputErrorHints,
  OperationInputSchemas,
  type OperationName,
  type RpcError,
  type ServerMessage,
  type SessionMetadata,
} from "@figma-mcp/protocol";
import type { z } from "zod";

export type OperationMode = "read" | "write";

export type OperationDefinition<Name extends OperationName = OperationName> = {
  name: Name;
  description: string;
  mode: OperationMode;
  inputSchema: (typeof OperationInputSchemas)[Name];
  timeoutMs: number;
};

export type OperationResult = { ok: true; result: unknown } | { ok: false; error: RpcError };

export const operationRegistry = [
  {
    name: "figma.document.getInfo",
    description: "Read basic information about the current Figma document.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.document.getInfo"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.selection.get",
    description: "Read the current canvas selection.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.selection.get"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.selection.set",
    description: "Replace the current page selection with nodes by id.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.selection.set"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.selection.clear",
    description: "Clear the current page selection.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.selection.clear"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.selection.selectAll",
    description: "Select all nodes on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.selection.selectAll"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.viewport.get",
    description: "Read the current viewport center and zoom.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.viewport.get"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.viewport.set",
    description: "Update the viewport center and/or zoom.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.viewport.set"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.document.getTree",
    description: "Read the current page node tree up to a bounded depth.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.document.getTree"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.node.get",
    description: "Read a canvas node by id.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.node.get"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.node.getChildren",
    description: "Read a node's child tree up to a bounded depth.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.node.getChildren"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.node.find",
    description: "Find nodes on the current page by type and/or name.",
    mode: "read",
    inputSchema: OperationInputSchemas["figma.node.find"],
    timeoutMs: 5_000,
  },
  {
    name: "figma.node.createRectangle",
    description: "Create a rectangle node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createRectangle"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.createEllipse",
    description: "Create an ellipse node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createEllipse"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.createLine",
    description: "Create a line node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createLine"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.createText",
    description: "Create a text node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createText"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.createFrame",
    description: "Create a frame node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createFrame"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.createSection",
    description: "Create a section node on the current page.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.createSection"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.update",
    description: "Update safe editable properties of an existing node.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.update"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.updateMany",
    description: "Update the same safe editable properties on multiple nodes.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.updateMany"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.node.delete",
    description: "Delete an existing node.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.node.delete"],
    timeoutMs: 8_000,
  },
  {
    name: "figma.page.create",
    description: "Create a new page in the current Figma document.",
    mode: "write",
    inputSchema: OperationInputSchemas["figma.page.create"],
    timeoutMs: 8_000,
  },
] as const satisfies readonly OperationDefinition[];

export type OperationRegistry = typeof operationRegistry;

export const operationsByName = new Map<OperationName, OperationDefinition>(
  operationRegistry.map((operation) => [operation.name, operation]),
);

export type ClientConnection = {
  send(message: ServerMessage): void | Promise<void>;
  close?(): void;
};

type PendingRequest = {
  resolve(result: OperationResult): void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
};

export type SessionSnapshot = {
  id: string;
  metadata: SessionMetadata;
  pendingRequests: number;
};

export class FigmaSession {
  readonly id: string;
  readonly metadata: SessionMetadata;
  readonly connectedAt: Date;

  #connection: ClientConnection;
  #pending = new Map<string, PendingRequest>();

  constructor(id: string, metadata: SessionMetadata, connection: ClientConnection) {
    this.id = id;
    this.metadata = metadata;
    this.connectedAt = new Date();
    this.#connection = connection;
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      metadata: this.metadata,
      pendingRequests: this.#pending.size,
    };
  }

  // 下发 operation.request 并登记 pending request；响应必须通过 requestId 回到 resolve/reject。
  async execute(definition: OperationDefinition, input: unknown): Promise<OperationResult> {
    const requestId = crypto.randomUUID();
    log(`dispatch operation: session=${this.id} operation=${definition.name} request=${requestId}`);

    return await new Promise<OperationResult>((resolve) => {
      const timeout = globalThis.setTimeout(() => {
        this.#pending.delete(requestId);
        log(
          `operation timeout: session=${this.id} operation=${definition.name} request=${requestId}`,
        );
        resolve({
          ok: false,
          error: {
            code: "TIMEOUT",
            message: `Operation timed out after ${definition.timeoutMs}ms.`,
          },
        });
      }, definition.timeoutMs);

      this.#pending.set(requestId, { resolve, timeout });

      void Promise.resolve(
        this.#connection.send({
          type: "operation.request",
          requestId,
          operation: definition.name,
          input,
        }),
      ).catch((error: unknown) => {
        globalThis.clearTimeout(timeout);
        this.#pending.delete(requestId);
        log(
          `operation transport error: session=${this.id} operation=${definition.name} request=${requestId}`,
          error,
        );
        resolve({
          ok: false,
          error: {
            code: "TRANSPORT_ERROR",
            message: "Failed to send operation to Figma client.",
            details: error instanceof Error ? error.message : error,
          },
        });
      });
    });
  }

  // 插件返回成功结果时完成 pending request；未知 requestId 通常表示已超时或 session 已重置。
  resolve(requestId: string, result: unknown): boolean {
    const pending = this.#pending.get(requestId);
    if (!pending) {
      return false;
    }

    globalThis.clearTimeout(pending.timeout);
    this.#pending.delete(requestId);
    log(`operation resolved: session=${this.id} request=${requestId}`);
    pending.resolve({ ok: true, result });
    return true;
  }

  // 插件返回业务错误时完成 pending request，错误结构必须符合协议层 RpcErrorSchema。
  reject(requestId: string, error: RpcError): boolean {
    const pending = this.#pending.get(requestId);
    if (!pending) {
      return false;
    }

    globalThis.clearTimeout(pending.timeout);
    this.#pending.delete(requestId);
    log(`operation rejected: session=${this.id} request=${requestId} code=${error.code}`);
    pending.resolve({ ok: false, error });
    return true;
  }

  // session 断开时释放所有 pending request，避免调用方一直等待到 timeout。
  dispose(reason = "Figma client disconnected."): void {
    log(`dispose session: session=${this.id} pending=${this.#pending.size} reason=${reason}`);
    for (const [requestId, pending] of this.#pending) {
      globalThis.clearTimeout(pending.timeout);
      this.#pending.delete(requestId);
      pending.resolve({
        ok: false,
        error: {
          code: "TRANSPORT_ERROR",
          message: reason,
        },
      });
    }
  }
}

export class FigmaKernel {
  #sessions = new Map<string, FigmaSession>();
  #activeSessionId?: string;

  // 注册新的 Figma 插件连接，并把最新连接设为 active session。
  registerSession(metadata: SessionMetadata, connection: ClientConnection): FigmaSession {
    const id = crypto.randomUUID();
    const session = new FigmaSession(id, metadata, connection);
    this.#sessions.set(id, session);
    this.#activeSessionId = id;
    log(`registered session: session=${id} plugin=${metadata.pluginId}`);
    return session;
  }

  // 注销断开的插件连接；如果断开的是 active session，则切换到剩余 session。
  unregisterSession(id: string): void {
    const session = this.#sessions.get(id);
    if (!session) {
      return;
    }

    session.dispose();
    this.#sessions.delete(id);
    log(`unregistered session: session=${id}`);

    if (this.#activeSessionId === id) {
      this.#activeSessionId = this.#sessions.keys().next().value;
    }
  }

  // 列出轻量 session 快照，供 HTTP /sessions 和 /health 诊断使用。
  listSessions(): SessionSnapshot[] {
    return Array.from(this.#sessions.values(), (session) => session.snapshot());
  }

  // WebSocket bridge 用 requestId 把插件成功结果路由回对应 pending request。
  resolveOperation(sessionId: string, requestId: string, result: unknown): boolean {
    return this.#sessions.get(sessionId)?.resolve(requestId, result) ?? false;
  }

  // WebSocket bridge 用 requestId 把插件业务错误路由回对应 pending request。
  rejectOperation(sessionId: string, requestId: string, error: RpcError): boolean {
    return this.#sessions.get(sessionId)?.reject(requestId, error) ?? false;
  }

  async executeOperation(
    operationName: OperationName,
    rawInput: unknown,
  ): Promise<OperationResult> {
    const definition = operationsByName.get(operationName);
    if (!definition) {
      log(`operation not found: operation=${operationName}`);
      return {
        ok: false,
        error: {
          code: "OPERATION_NOT_FOUND",
          message: `Unsupported operation: ${operationName}`,
        },
      };
    }

    const parsedInput = parseInput(operationName, definition.inputSchema, rawInput);
    if (!parsedInput.ok) {
      log(`invalid operation input: operation=${operationName}`);
      return parsedInput;
    }

    const session = this.getActiveSession();
    if (!session) {
      log(`operation blocked: no active Figma session for operation=${operationName}`);
      return {
        ok: false,
        error: {
          code: "NOT_CONNECTED",
          message: "Figma client not connected.",
        },
      };
    }

    return await session.execute(definition, parsedInput.result);
  }

  getCapabilities(): OperationDefinition[] {
    return [...operationRegistry];
  }

  // 当前策略是最新连接优先；未来如支持多文档，可在这里引入 session selector。
  private getActiveSession(): FigmaSession | undefined {
    if (this.#activeSessionId) {
      return this.#sessions.get(this.#activeSessionId);
    }

    return this.#sessions.values().next().value;
  }
}

// operation input 在进入插件前统一校验，避免无效 payload 到达 Figma runtime。
function parseInput(
  operationName: OperationName,
  schema: z.ZodTypeAny,
  rawInput: unknown,
): OperationResult {
  const parsed = schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const details = {
      ...parsed.error.flatten(),
      hints: getInputErrorHints(operationName, rawInput),
    };
    return {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Invalid operation input.",
        details,
      },
    };
  }

  return { ok: true, result: parsed.data };
}

// core 层日志用于定位 session 路由和 pending request 生命周期。
function log(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[figma-core] ${message}`);
    return;
  }

  console.log(`[figma-core] ${message}`, details);
}
