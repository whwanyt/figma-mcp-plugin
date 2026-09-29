import type { FigmaKernel } from "@figma-mcp/core";
import { operationRegistry } from "@figma-mcp/core";
import type { OperationResult } from "@figma-mcp/core";
import type { OperationName } from "@figma-mcp/protocol";
import { getToolDescription } from "@figma-mcp/figma-ops";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

// 将 core registry 中的 operation 映射为 MCP tools，保持 MCP 暴露面与内部能力表一致。
export function createMcpServer(kernel: FigmaKernel) {
  const server = new McpServer({
    name: "figma-mcp-server",
    version: "0.0.0",
  });

  for (const operation of operationRegistry) {
    server.registerTool(
      operation.name,
      {
        title: operation.name,
        description: getToolDescription(operation.name, operation.description),
        inputSchema: zodObjectShape(operation.inputSchema),
      },
      async (input: unknown) => {
        const result = await kernel.executeOperation(operation.name as OperationName, input);
        let text: string;
        if (isOperationSuccess(result)) {
          text = JSON.stringify(result.result, null, 2);
        } else {
          text = JSON.stringify(result.error, null, 2);
        }

        return {
          isError: !result.ok,
          content: [
            {
              type: "text",
              text,
            },
          ],
        };
      },
    );
  }

  return server;
}

// 每个 Streamable HTTP 请求创建独立 transport；实际 Figma session 状态保存在共享 kernel 中。
export async function handleMcpNodeRequest(
  kernel: FigmaKernel,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const server = createMcpServer(kernel);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  await transport.handleRequest(request, response);
}

// MCP SDK 需要 Zod object shape；ZodPipe/ZodTransform 场景下递归解包，避免 transform 让 tool 入参退化为空对象。
function zodObjectShape(schema: z.ZodTypeAny): z.ZodRawShape {
  const objectSchema = unwrapZodObject(schema);
  return objectSchema?.shape ?? {};
}

function unwrapZodObject(schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> | undefined {
  if (schema instanceof z.ZodObject) {
    return schema;
  }

  const definition = schema.def as { in?: z.ZodTypeAny; out?: z.ZodTypeAny } | undefined;
  if (definition?.out) {
    return unwrapZodObject(definition.out);
  }
  if (definition?.in) {
    return unwrapZodObject(definition.in);
  }

  return undefined;
}

// MCP tool result 需要根据 OperationResult 显式标记 isError。
function isOperationSuccess(
  result: OperationResult,
): result is Extract<OperationResult, { ok: true }> {
  return result.ok;
}
