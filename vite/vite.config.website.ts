import type { InlineConfig } from "vitest";
import { defineConfig } from "vite";
import { baseConfig } from "./vite.config.base";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export default defineConfig({
  ...baseConfig,
  build: {
    outDir: "dist/website",
    sourcemap: true,
    rollupOptions: {
      external: ["crypto", "stream"],
    },
  },
});
