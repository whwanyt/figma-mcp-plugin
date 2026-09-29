import { describe, expect, test } from "vite-plus/test";
import { createHttpApp } from "../src/app.ts";

describe("http app", () => {
  test("reports health", async () => {
    const response = await createHttpApp().request("/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "figma-mcp-server",
    });
  });

  test("reports capabilities", async () => {
    const response = await createHttpApp().request("/capabilities");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      operations: Array<{ name: string; description: string; usageHints: string[] }>;
      figma: Array<{ name: string; usageHints: string[] }>;
    };
    expect(body.operations.length).toBeGreaterThan(0);
    const updateMany = body.operations.find(
      (operation) => operation.name === "figma.node.updateMany",
    );
    expect(updateMany?.description).toContain("Input guidance");
    expect(updateMany?.usageHints.join("\n")).toContain("filter compatible node types");
    expect(
      body.figma.find((operation) => operation.name === "figma.node.update")?.usageHints,
    ).toEqual(expect.arrayContaining([expect.stringContaining("Whole-node transparency")]));
  });
});
