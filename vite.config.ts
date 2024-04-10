import { InlineConfig } from "vitest";
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import macros from "unplugin-parcel-macros";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: [path.resolve(__dirname, "tests/utils/setup.ts")],
    server: {
      deps: {
        external: ["wagmi"],
        inline: ["@tronweb3/tronwallet-adapter-bitkeep"],
      },
    },
  },
  plugins: [macros.vite(), react(), vanillaExtractPlugin()],
  build: {
    outDir: "dist/website",
    sourcemap: true,
    commonjsOptions: {
      include: [/types/, /node_modules/], // `/types/` is for @stakekit/common
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: ["crypto", "stream"],
      onwarn(warning, defaultHandler) {
        if (warning.code === "SOURCEMAP_ERROR") {
          return;
        }

        defaultHandler(warning);
      },
    },
  },
  esbuild: { drop: ["console"] },
  server: { host: true },
});
