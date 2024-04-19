import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import type { UserConfig } from "vite";
import path from "path";
import macros from "unplugin-parcel-macros";
import type { InlineConfig } from "vitest";
import merge from "lodash.merge";
import { nodePolyfills } from "vite-plugin-node-polyfills";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export const getConfig = (overides?: Partial<UserConfig>): UserConfig =>
  merge(overides, {
    root: path.resolve(__dirname, ".."),
    test: {
      environment: "jsdom",
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: [path.resolve(__dirname, "..", "tests/utils/setup.ts")],
      server: {
        deps: {
          external: ["wagmi"],
          inline: ["@tronweb3/tronwallet-adapter-bitkeep"],
        },
      },
    },
    plugins: [
      macros.vite(),
      react(),
      vanillaExtractPlugin(),
      nodePolyfills({ include: ["buffer"] }),
    ],
    esbuild: { drop: ["console"] },
    server: { host: true },
    resolve: {
      alias: {
        crypto: path.resolve(__dirname, "..", "polyfills", "empty.js"),
        stream: path.resolve(__dirname, "..", "polyfills", "empty.js"),
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  } satisfies UserConfig);
