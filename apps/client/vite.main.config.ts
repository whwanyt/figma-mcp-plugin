import { resolve } from "node:path";

import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    emptyOutDir: false,
    target: "es2015",
    minify: false,
    rollupOptions: {
      input: resolve("lib/main.ts"),
      output: {
        entryFileNames: "main.js",
        format: "iife",
        name: "FigmaMcpPluginMain",
      },
    },
  },
});
