import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

import { defineConfig, type Plugin } from "vite-plus";

function copyManifest(): Plugin {
  return {
    name: "copy-manifest",
    apply: "build",
    async closeBundle() {
      await copyFile(resolve("./manifest.json"), resolve("dist/manifest.json"));
    },
  };
}

export default defineConfig({
  plugins: [copyManifest(), viteSingleFile()],
  build: {
    assetsDir: "",
    assetsInlineLimit: () => true,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve("index.html"),
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
