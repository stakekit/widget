import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base";

export default defineConfig(
  getConfig({
    build: {
      outDir: "dist/website",
      sourcemap: true,
    },
  })
);
