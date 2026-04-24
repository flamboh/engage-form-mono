import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
});
