import { FigmaKernel, operationRegistry } from "@figma-mcp/core";
import { OperationRequestSchema, type OperationName } from "@figma-mcp/protocol";
import { getToolDescription, getUsageHints, supportedFigmaOperations } from "@figma-mcp/figma-ops";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

export type AppBindings = {
  Variables: {
    kernel: FigmaKernel;
  };
};

// 创建 Hono HTTP app；kernel 由入口注入，确保 HTTP debug 和 MCP/WebSocket 共用同一批 session。
export function createHttpApp(kernel = new FigmaKernel()) {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("kernel", kernel);
    await next();
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "figma-mcp-server",
      sessions: c.var.kernel.listSessions().length,
    }),
  );

  app.get("/sessions", (c) => c.json({ sessions: c.var.kernel.listSessions() }));

  app.get("/capabilities", (c) =>
    c.json({
      operations: operationRegistry.map((operation) => ({
        name: operation.name,
        description: getToolDescription(operation.name, operation.description),
        mode: operation.mode,
        timeoutMs: operation.timeoutMs,
        usageHints: getUsageHints(operation.name),
      })),
      figma: supportedFigmaOperations,
    }),
  );

  // 开发期直连 operation 的调试入口，用于排查 MCP client 之外的协议和插件链路问题。
  app.post("/debug/operation", zValidator("json", OperationRequestSchema), async (c) => {
    if (process.env.NODE_ENV === "production") {
      return c.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Debug operations are disabled in production.",
          },
        },
        403,
      );
    }

    const body = c.req.valid("json");
    const result = await c.var.kernel.executeOperation(body.operation as OperationName, body.input);

    return c.json(result, result.ok ? 200 : 400);
  });

  return app;
}
