import path from "node:path";
import { defineConfig } from "vite";
import type { InlineConfig } from "vitest";
import { getConfig } from "./vite.config.base";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export default defineConfig(
  getConfig({
    build: {
      lib: {
        entry: path.resolve(__dirname, "..", "src/index.bundle.ts"),
        name: "StakeKit",
        fileName: "index.bundle",
        formats: ["es"],
      },
      copyPublicDir: false,
      outDir: "dist/bundle",
      sourcemap: true,
    },
  })
);
