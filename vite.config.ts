import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: ["convex/_generated/**"],
  },
  run: {
    cache: true,
  },
});
