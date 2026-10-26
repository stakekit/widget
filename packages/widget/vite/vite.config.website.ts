import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base.ts";

// The playground page: QA reads its wallet, API and tracking logs in the console.
export default defineConfig(
  getConfig(
    {
      build: {
        outDir: "dist/website",
        sourcemap: true,
      },
    },
    { keepConsole: true }
  )
);
