import path from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import { getConfig } from "./vite.config.base";

const config = getConfig({
  define: {
    // Drop dead AMD branches from bundled UMD dependencies so Next Turbopack
    // does not resolve their dependency arrays as real relative imports.
    define: "undefined",
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "..", "src/index.package.ts"),
      name: "StakeKit",
      fileName: "index.package",
      formats: ["es"],
    },
    rolldownOptions: {
      output: { banner: '"use client";\n' },
      plugins: [
        esmExternalRequirePlugin({
          external: [/^react(-dom)?(\/.+)?$/],
        }),
      ],
    },
    copyPublicDir: false,
    minify: false,
    outDir: "dist/package",
    sourcemap: false,
  },
});

export default defineConfig(config);
