import path from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import { getConfig } from "./vite.config.base";

const reactExternals = [/^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/];

const config = getConfig(
  {
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
        external: reactExternals,
        output: { banner: '"use client";\n' },
      },
      copyPublicDir: false,
      minify: false,
      outDir: "dist/package",
      sourcemap: false,
    },
  },
  {
    plugins: [
      esmExternalRequirePlugin({
        external: reactExternals,
        skipDuplicateCheck: true,
      }),
    ],
  }
);

export default defineConfig(config);
