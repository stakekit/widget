import type { InlineConfig } from "vitest";
import { defineConfig } from "vite";
import path from "path";
import { baseConfig } from "./vite.config.base";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export default defineConfig({
  ...baseConfig,
  build: {
    lib: {
      entry: path.resolve(__dirname, "..", "src/index.bundle.ts"),
      name: "StakeKit",
      fileName: "index.bundle",
      formats: ["umd"],
    },
    rollupOptions: {
      external: ["crypto", "stream"],
    },
    copyPublicDir: false,
    outDir: "dist/bundle",
    sourcemap: true,
  },
});
