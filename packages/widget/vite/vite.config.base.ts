import path from "node:path";
import replace from "@rollup/plugin-replace";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import autoprefixer from "autoprefixer";
import merge from "lodash.merge";
import macros from "unplugin-macros/vite";
import { defineConfig, type UserConfig, type UserConfigFnObject } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { InlineConfig } from "vitest/node";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

const emptyPolyfill = path.resolve(__dirname, "..", "polyfills", "empty.js");

export const getConfig = (overides?: Partial<UserConfig>): UserConfigFnObject =>
  defineConfig(({ mode }) => {
    const isProd = mode === "build";

    return merge(overides, {
      root: path.resolve(__dirname, ".."),
      optimizeDeps: {
        include: [
          "vite-plugin-node-polyfills/shims/buffer",
          "vite-plugin-node-polyfills/shims/global",
          "vite-plugin-node-polyfills/shims/process",
          "@vanilla-extract/recipes/createRuntimeFn",
          "@vanilla-extract/sprinkles/createRuntimeSprinkles",
          "date-fns/locale",
        ],
      },
      test: {
        browser: {
          enabled: true,
          provider: playwright(),
          instances: [{ browser: "chromium" }],
          viewport: { width: 800, height: 900 },
          headless: true,
        },
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: [path.resolve(__dirname, "..", "tests/utils/setup.ts")],
      },
      plugins: [
        macros(),
        react({
          babel: {
            plugins: [["babel-plugin-react-compiler"]],
          },
        }),
        vanillaExtractPlugin(),
        nodePolyfills({ include: ["buffer", "crypto"] }),
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
          crypto: emptyPolyfill,
          stream: emptyPolyfill,
          ws: emptyPolyfill,
          "@emotion/is-prop-valid": emptyPolyfill,
          "@react-native-async-storage/async-storage": emptyPolyfill,
        },
      },
      build: {
        sourcemap: false,
        commonjsOptions: {
          transformMixedEsModules: true,
        },
        rollupOptions: {
          plugins: [
            replace({
              values: {
                'require("@emotion/is-prop-valid")':
                  "({ default: () => true })",
              },
              preventAssignment: true,
              delimiters: ["", ""],
            }),
          ],
        },
      },
    } satisfies UserConfig);
  });
