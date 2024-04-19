import type { InlineConfig } from "vitest";
import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export default defineConfig(
  getConfig({
    build: {
      outDir: "dist/website",
      sourcemap: true,
    },
  })
);
