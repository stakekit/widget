import path from "node:path";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import merge from "lodash.merge";
import macros from "unplugin-parcel-macros";
import { defineConfig, type UserConfig, type UserConfigFnObject } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { InlineConfig } from "vitest/node";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

export const getConfig = (overides?: Partial<UserConfig>): UserConfigFnObject =>
  defineConfig(({ mode }) => {
    const isProd = mode === "build";

    return merge(overides, {
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
        react({
          babel: {
            plugins: [
              [
                "babel-plugin-react-compiler",
                {
                  target: "18",
                },
              ],
            ],
          },
        }),
        vanillaExtractPlugin(),
        nodePolyfills({ include: ["buffer"] }),
      ],
      css: {
        postcss: {
          plugins: [autoprefixer()],
        },
      },
      esbuild: { drop: isProd ? ["console"] : [] },
      server: {
        host: true,
        cors: true,
        // https: {
        //   key: path.resolve(__dirname, "..", "certificates", "skwidget.key"),
        //   cert: path.resolve(__dirname, "..", "certificates", "skwidget.crt"),
        // },
      },
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
  });
