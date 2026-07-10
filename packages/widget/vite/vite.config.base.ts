import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import autoprefixer from "autoprefixer";
import merge from "lodash.merge";
import macros from "unplugin-macros/vite";
import {
  defineConfig,
  type Plugin,
  type UserConfig,
  type UserConfigFnObject,
} from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { InlineConfig } from "vitest/node";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

// @vanilla-extract/vite-plugin 5.2.4 declines virtual CSS modules whose
// source file only composes existing classes and therefore emits no new CSS.
// Preserve the plugin's pre-5.2.4 empty-module behavior as a post hook.
const vanillaExtractEmptyCssFallback: Plugin = {
  name: "stakekit:vanilla-extract-empty-css-fallback",
  enforce: "post",
  resolveId(source) {
    const [id] = source.split("?");
    if (id?.endsWith(".vanilla.css")) return source;
  },
  load(source) {
    const [id] = source.split("?");
    if (id?.endsWith(".vanilla.css")) return "";
  },
};

export const getConfig = (
  overides?: Partial<UserConfig>,
  options?: { plugins?: Plugin[] }
): UserConfigFnObject =>
  defineConfig(({ command }) => {
    const isBuild = command === "build";
    const shouldMinifyOutput = isBuild && overides?.build?.minify !== false;

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
          screenshotFailures: false,
          provider: playwright(),
          instances: [{ browser: "chromium" }],
          viewport: { width: 800, height: 900 },
          headless: true,
        },
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: [path.resolve(__dirname, "..", "tests/utils/setup.ts")],
      },
      plugins: [
        ...(options?.plugins ?? []),
        nodePolyfills({ include: ["buffer", "crypto"] }),
        macros(),
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        vanillaExtractPlugin(),
        vanillaExtractEmptyCssFallback,
      ],
      css: {
        postcss: {
          plugins: [autoprefixer()],
        },
      },
      server: {
        host: true,
        cors: true,
      },
      build: {
        reportCompressedSize: false,
        sourcemap: false,
        rolldownOptions: {
          ...(shouldMinifyOutput && {
            output: {
              minify: {
                compress: {
                  dropConsole: true,
                },
              },
            },
          }),
        },
      },
    });
  });
