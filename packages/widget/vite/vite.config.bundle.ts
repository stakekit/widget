import path from "node:path";

import { defineConfig } from "vite";

import { chunkRelativeAssetUrls, getConfig } from "./vite.config.base.ts";

export default defineConfig(
  getConfig({
    experimental: chunkRelativeAssetUrls,
    build: {
      lib: {
        entry: path.resolve(import.meta.dirname, "..", "src/index.bundle.ts"),
        name: "StakeKit",
        fileName: "index.bundle",
        formats: ["es"],
      },
      copyPublicDir: false,
      // `.vite/manifest.json` for check:bundle-size.
      manifest: true,
      outDir: "dist/bundle",
      sourcemap: false,
    },
  })
);
