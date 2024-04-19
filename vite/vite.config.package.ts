import type { InlineConfig } from "vitest";
import { defineConfig } from "vite";
import path from "path";
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
  })
);
