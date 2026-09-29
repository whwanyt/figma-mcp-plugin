import { describe, expect, test, vi } from "vite-plus/test";
import { sendMsgToPlugin } from "./sender.ts";

describe("sendMsgToPlugin", () => {
  test("posts the bridge message to the Figma parent frame", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("parent", { postMessage });

    const message = {
      type: "bridge.operation",
      requestId: "request-1",
      operation: "figma.selection.get",
      input: {},
    } as const;

    sendMsgToPlugin(message);

    expect(postMessage).toHaveBeenCalledWith({ pluginMessage: message }, "*");
  });
});
