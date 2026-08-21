import path from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import { getConfig } from "./vite.config.base.ts";

const config = getConfig({
  define: {
    // Drop dead AMD branches from bundled UMD dependencies so Next Turbopack
    // does not resolve their dependency arrays as real relative imports.
    define: "undefined",
  },
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, "..", "src/index.package.ts"),
      name: "StakeKit",
      fileName: "index.package",
      formats: ["es"],
    },
    rolldownOptions: {
      output: {
        banner: '"use client";\n',
        // Keep @cosmos-kit with its circular helpers in one chunk. Splitting that
        // graph leaves `State` as an uninitialized live binding after a host
        // re-bundles dist/package.
        codeSplitting: {
          groups: [
            {
              name: "cosmos-kit",
              test: /[/\\]node_modules[/\\]@cosmos-kit[/\\]/,
            },
          ],
        },
      },
      plugins: [
        esmExternalRequirePlugin({
          // Keep React and ReactDOM external for the host. Bundle
          // `react/compiler-runtime`: it is CommonJS, and hosts that exclude this
          // package from optimizeDeps otherwise fail to prebundle that subpath.
          external: [/^react(-dom)?(?!\/compiler-runtime)(\/.+)?$/],
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
