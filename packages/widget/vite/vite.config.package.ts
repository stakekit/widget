import path from "node:path";
import { defineConfig } from "vite";
import type { InlineConfig } from "vitest";
import { getConfig } from "./vite.config.base";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

const config = getConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "..", "src/index.package.ts"),
      name: "StakeKit",
      fileName: "index.package",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: { banner: '"use client";\n' },
    },
    copyPublicDir: false,
    outDir: "dist/package",
    sourcemap: true,
  },
});

export default defineConfig(config);
