import { describe, expect, test } from "vite-plus/test";
import {
  ClientMessageSchema,
  OperationInputSchemas,
  ViewportSetInputSchema,
  parseJsonMessage,
} from "../src/index.ts";

describe("protocol schemas", () => {
  test("parses hello messages", () => {
    const message = ClientMessageSchema.parse({
      type: "hello",
      session: { pluginId: "figma", connectedAt: new Date().toISOString() },
    });

    expect(message.type).toBe("hello");
  });

  test("requires viewport update payloads to change something", () => {
    expect(() => ViewportSetInputSchema.parse({})).toThrow();
    expect(ViewportSetInputSchema.parse({ zoom: 1 })).toEqual({ zoom: 1 });
  });

  test("keeps operation schema registry aligned with supported commands", () => {
    expect(OperationInputSchemas["figma.selection.get"].parse({})).toEqual({});
    expect(OperationInputSchemas["figma.node.createEllipse"]).toBeDefined();
    expect(OperationInputSchemas["figma.document.getTree"]).toBeDefined();
    expect(OperationInputSchemas["figma.selection.set"]).toBeDefined();
    expect(OperationInputSchemas["figma.node.updateMany"]).toBeDefined();
  });

  test("defaults and bounds tree query depth", () => {
    expect(OperationInputSchemas["figma.document.getTree"].parse({})).toEqual({
      maxDepth: 2,
    });
    expect(OperationInputSchemas["figma.node.getChildren"].parse({ id: "node-1" })).toEqual({
      id: "node-1",
      maxDepth: 1,
    });
    expect(() => OperationInputSchemas["figma.document.getTree"].parse({ maxDepth: 7 })).toThrow();
  });

  test("defaults text and page creation inputs", () => {
    expect(
      OperationInputSchemas["figma.node.createText"].parse({
        x: 0,
        y: 0,
      }),
    ).toEqual({ x: 0, y: 0, characters: "Text" });
    expect(OperationInputSchemas["figma.page.create"].parse({})).toEqual({
      makeCurrent: false,
    });
  });

  test("requires non-empty selection ids", () => {
    expect(() => OperationInputSchemas["figma.selection.set"].parse({ ids: [] })).toThrow();
    expect(OperationInputSchemas["figma.selection.set"].parse({ ids: ["node-1"] })).toEqual({
      ids: ["node-1"],
    });
  });

  test("defaults solid paint alpha to Figma RGBA requirements", () => {
    expect(
      OperationInputSchemas["figma.node.createRectangle"].parse({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      }).fills,
    ).toEqual([{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }]);
  });

  test("parses Priority 2 node style updates", () => {
    expect(
      OperationInputSchemas["figma.node.update"].parse({
        id: "node-1",
        rotation: 12,
        visible: false,
        locked: true,
        opacity: 0.5,
        cornerRadius: 8,
        strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
        strokeWeight: 2,
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 0, g: 0, b: 0 },
            radius: 16,
          },
        ],
      }),
    ).toMatchObject({
      id: "node-1",
      visible: false,
      locked: true,
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      effects: [
        {
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          spread: 0,
          visible: true,
          blendMode: "NORMAL",
        },
      ],
    });
  });

  test("normalizes common paint and effect aliases", () => {
    expect(
      OperationInputSchemas["figma.node.update"].parse({
        id: "node-1",
        isVisible: false,
        isLocked: true,
        fills: [
          {
            type: "SOLID",
            color: { r: 0.36, g: 0.45, b: 1 },
            opacity: 0.28,
            visible: true,
          },
        ],
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 0, g: 0, b: 0 },
            radius: 12,
            isVisible: false,
          },
        ],
      }),
    ).toMatchObject({
      id: "node-1",
      visible: false,
      locked: true,
      fills: [
        {
          type: "SOLID",
          color: { r: 0.36, g: 0.45, b: 1, a: 0.28 },
          visible: true,
        },
      ],
      effects: [
        {
          type: "DROP_SHADOW",
          visible: false,
        },
      ],
    });
  });

  test("normalizes updateMany patch aliases", () => {
    expect(
      OperationInputSchemas["figma.node.updateMany"].parse({
        ids: ["node-1"],
        patch: {
          isVisible: true,
          fills: [
            {
              type: "GRADIENT_LINEAR",
              opacity: 0.4,
              gradientStops: [
                { position: 0, color: { r: 1, g: 0, b: 0 } },
                { position: 1, color: { r: 0, g: 0, b: 1 } },
              ],
            },
          ],
        },
      }),
    ).toMatchObject({
      ids: ["node-1"],
      patch: {
        visible: true,
        fills: [
          {
            type: "GRADIENT_LINEAR",
            gradientStops: [
              { position: 0, color: { r: 1, g: 0, b: 0, a: 0.4 } },
              { position: 1, color: { r: 0, g: 0, b: 1, a: 0.4 } },
            ],
          },
        ],
      },
    });
  });

  test("parses gradient and image paint shapes from Figma typings", () => {
    expect(
      OperationInputSchemas["figma.node.update"].parse({
        id: "node-1",
        fills: [
          {
            type: "GRADIENT_LINEAR",
            gradientStops: [
              { position: 0, color: { r: 1, g: 0, b: 0 } },
              { position: 1, color: { r: 0, g: 0, b: 1, a: 0.8 } },
            ],
          },
          {
            type: "IMAGE",
            imageRef: "image-ref",
            scaleMode: "FILL",
          },
        ],
      }).fills,
    ).toEqual([
      {
        type: "GRADIENT_LINEAR",
        transform: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 0.8 } },
        ],
      },
      {
        type: "IMAGE",
        imageHash: "image-ref",
        scaleMode: "FILL",
      },
    ]);
  });

  test("requires updateMany to carry ids and a non-empty patch", () => {
    expect(() =>
      OperationInputSchemas["figma.node.updateMany"].parse({
        ids: [],
        patch: { x: 1 },
      }),
    ).toThrow();
    expect(() =>
      OperationInputSchemas["figma.node.updateMany"].parse({
        ids: ["node-1"],
        patch: {},
      }),
    ).toThrow();
    expect(
      OperationInputSchemas["figma.node.updateMany"].parse({
        ids: ["node-1", "node-2"],
        patch: { opacity: 0.6 },
      }),
    ).toEqual({
      ids: ["node-1", "node-2"],
      patch: { opacity: 0.6 },
    });
  });

  test("parses json strings without requiring transport-specific code", () => {
    expect(parseJsonMessage('{"type":"ping"}')).toEqual({ type: "ping" });
    expect(parseJsonMessage("not json")).toBe("not json");
  });
});
