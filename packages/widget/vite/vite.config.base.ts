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
import { hostBundlerOutputPlugin } from "./host-bundler-output.ts";

declare module "vite" {
  interface UserConfig {
    test?: InlineConfig;
  }
}

// A path from the chunk that references an asset to the asset.
const chunkRelativePath = (filename: string, hostId: string) => {
  const relative = path.posix.relative(path.posix.dirname(hostId), filename);
  return relative.startsWith("../") ? relative : `./${relative}`;
};

// Emits `new URL("./assets/…", import.meta.url)`, the form webpack, Turbopack
// and Vite hosts detect and copy into their own output. It resolves against
// the chunk, so it stays correct wherever the host serves `dist`. Worker sites
// wrap it once more; `hostBundlerOutputPlugin` collapses those.
export const chunkRelativeAssetUrls: NonNullable<UserConfig["experimental"]> = {
  renderBuiltUrl: (filename, { hostId, hostType }) =>
    hostType === "js"
      ? {
          runtime: `new URL(${JSON.stringify(chunkRelativePath(filename, hostId))}, import.meta.url).href`,
        }
      : undefined,
};

export const getConfig = (
  overides?: Partial<UserConfig>,
  options?: {
    plugins?: Plugin[];
    /** Keeps `console` calls in minified output; the playground logs to the console. */
    keepConsole?: boolean;
  }
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
        nodePolyfills({ include: ["buffer", "crypto", "stream"] }),
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
        hostBundlerOutputPlugin(),
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
                  dropConsole: !options?.keepConsole,
                },
              },
            },
          }),
        },
      },
    });
  });
