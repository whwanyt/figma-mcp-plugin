import type { PluginBridgeMessage } from "@figma-mcp/protocol";

/**
 * 向UI发送消息
 */
export const sendMsgToUI = (data: PluginBridgeMessage) => {
  figma.ui.postMessage(data);
};

/**
 * 向插件发送消息
 */
export const sendMsgToPlugin = (data: PluginBridgeMessage) => {
  parent.postMessage({ pluginMessage: data }, "*");
};
