import { describe, expect, test, vi } from "vite-plus/test";
import { FigmaKernel, operationsByName } from "../src/index.ts";

describe("operation registry", () => {
  test("contains safe v1 operations", () => {
    expect(operationsByName.has("figma.selection.get")).toBe(true);
    expect(operationsByName.has("figma.node.delete")).toBe(true);
    expect(operationsByName.has("figma.node.createText")).toBe(true);
    expect(operationsByName.has("figma.document.getTree")).toBe(true);
    expect(operationsByName.has("figma.selection.set")).toBe(true);
    expect(operationsByName.has("figma.node.updateMany")).toBe(true);
  });
});

describe("kernel routing", () => {
  test("returns a structured error when no plugin is connected", async () => {
    const kernel = new FigmaKernel();
    const result = await kernel.executeOperation("figma.selection.get", {});

    expect(result).toEqual({
      ok: false,
      error: {
        code: "NOT_CONNECTED",
        message: "Figma client not connected.",
      },
    });
  });

  test("correlates websocket responses by request id", async () => {
    const kernel = new FigmaKernel();
    const send = vi.fn();
    const session = kernel.registerSession({ pluginId: "test" }, { send });

    const pending = kernel.executeOperation("figma.selection.get", {});
    const message = send.mock.calls[0]?.[0];
    expect(message.type).toBe("operation.request");

    kernel.resolveOperation(session.id, message.requestId, [{ id: "1" }]);

    await expect(pending).resolves.toEqual({
      ok: true,
      result: [{ id: "1" }],
    });
  });

  test("routes new Priority 1 operations to the active session", async () => {
    const kernel = new FigmaKernel();
    const send = vi.fn();
    const session = kernel.registerSession({ pluginId: "test" }, { send });

    const pending = kernel.executeOperation("figma.node.createText", {
      x: 10,
      y: 20,
    });
    const message = send.mock.calls[0]?.[0];

    expect(message).toMatchObject({
      type: "operation.request",
      operation: "figma.node.createText",
      input: {
        x: 10,
        y: 20,
        characters: "Text",
      },
    });

    kernel.resolveOperation(session.id, message.requestId, { id: "text-1" });
    await expect(pending).resolves.toEqual({ ok: true, result: { id: "text-1" } });
  });

  test("routes Priority 2 batch updates to the active session", async () => {
    const kernel = new FigmaKernel();
    const send = vi.fn();
    const session = kernel.registerSession({ pluginId: "test" }, { send });

    const pending = kernel.executeOperation("figma.node.updateMany", {
      ids: ["node-1", "node-2"],
      patch: {
        opacity: 0.8,
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      },
    });
    const message = send.mock.calls[0]?.[0];

    expect(message).toMatchObject({
      type: "operation.request",
      operation: "figma.node.updateMany",
      input: {
        ids: ["node-1", "node-2"],
        patch: {
          opacity: 0.8,
          fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
        },
      },
    });

    kernel.resolveOperation(session.id, message.requestId, [{ id: "node-1" }, { id: "node-2" }]);
    await expect(pending).resolves.toEqual({
      ok: true,
      result: [{ id: "node-1" }, { id: "node-2" }],
    });
  });

  test("returns actionable hints for common invalid input", async () => {
    const kernel = new FigmaKernel();
    const result = await kernel.executeOperation("figma.node.update", {
      id: "node-1",
      fills: [
        {
          type: "SOLID",
          color: { r: 1, g: 1, b: 1 },
          opacity: 0.4,
          unexpected: true,
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        details: {
          hints: [
            {
              path: "fills[0].opacity",
            },
          ],
        },
      },
    });
  });

  test("times out unanswered operations", async () => {
    vi.useFakeTimers();
    const kernel = new FigmaKernel();
    kernel.registerSession({ pluginId: "test" }, { send: vi.fn() });

    const pending = kernel.executeOperation("figma.selection.get", {});
    await vi.advanceTimersByTimeAsync(5_001);

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: "TIMEOUT" },
    });

    vi.useRealTimers();
  });
});
