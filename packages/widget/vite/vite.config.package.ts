import path from "node:path";
import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base";

const config = getConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "..", "src/index.package.ts"),
      name: "StakeKit",
      fileName: "index.package",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
      output: { banner: '"use client";\n' },
    },
    copyPublicDir: false,
    outDir: "dist/package",
    sourcemap: false,
  },
});

export default defineConfig(config);
