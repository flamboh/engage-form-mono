import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

const workspaceRoot = resolve(import.meta.dirname, "../..");

export default defineConfig({
  envDir: workspaceRoot,
  envPrefix: ["VITE_", "PUBLIC_"],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "index.html"),
        background: resolve(import.meta.dirname, "src/background.ts"),
        content: resolve(import.meta.dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
