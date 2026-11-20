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
      // Library builds in ES format print minified code with its whitespace
      // (`codegen: false`) to keep `/*#__PURE__*/` annotations for hosts that
      // tree-shake. The printer keeps those annotations and the bundler
      // directives (`webpackIgnore`, `turbopackIgnore`, `@vite-ignore`) anyway,
      // and this self-contained renderer leaves hosts nothing to tree-shake.
      rolldownOptions: { output: { minify: { codegen: true } } },
    },
  })
);
