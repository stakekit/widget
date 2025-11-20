import path from "node:path";
import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base";

export default defineConfig(
  getConfig({
    build: {
      lib: {
        entry: path.resolve(__dirname, "..", "src/index.bundle.ts"),
        name: "StakeKit",
        fileName: "index.bundle",
        formats: ["es"],
      },
      copyPublicDir: false,
      outDir: "dist/bundle",
      sourcemap: false,
    },
  })
);
