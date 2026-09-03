import path from "node:path";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import macros from "unplugin-macros/vite";
import {
  defineConfig,
  mergeConfig,
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

export const getConfig = (
  overides?: Partial<UserConfig>,
  options?: { plugins?: Plugin[] }
): UserConfigFnObject =>
  defineConfig(({ command }) => {
    const isBuild = command === "build";
    const shouldMinifyOutput = isBuild && overides?.build?.minify !== false;

    return mergeConfig(overides ?? {}, {
      root: path.resolve(import.meta.dirname, ".."),
      optimizeDeps: {
        include: [
          "vite-plugin-node-polyfills/shims/buffer",
          "vite-plugin-node-polyfills/shims/global",
          "vite-plugin-node-polyfills/shims/process",
          "@vanilla-extract/recipes/createRuntimeFn",
          "@vanilla-extract/sprinkles/createRuntimeSprinkles",
          "react-router/dom",
        ],
      },
      plugins: [
        ...(options?.plugins ?? []),
        nodePolyfills({ include: ["buffer", "crypto"] }),
        macros(),
        react({
          compiler: true,
          // Skip large generated and data-only modules that gain nothing from
          // React Compiler.
          exclude: [
            /[/\\]node_modules[/\\]|^\0rolldown\/runtime\.js$/,
            /[/\\]src[/\\]generated[/\\]/,
            // Macro-inlined cosmos chain registry data.
            /[/\\]adapters[/\\]cosmos[/\\]chains[/\\]chain-registry\.ts$/,
          ],
        }),
        vanillaExtractPlugin(),
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
