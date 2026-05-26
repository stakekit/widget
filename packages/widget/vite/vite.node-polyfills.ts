import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const require = createRequire(import.meta.url);

type NodePolyfillShim = "buffer" | "global" | "process";

const getNodePolyfillShim = (shim: NodePolyfillShim) =>
  require
    .resolve(`vite-plugin-node-polyfills/shims/${shim}`)
    .replace(/\.cjs$/, ".js");

const getNodePolyfillShimRoot = (shim: NodePolyfillShim) =>
  path.dirname(path.dirname(getNodePolyfillShim(shim)));

const nodePolyfillShimAliases = {
  buffer: getNodePolyfillShimRoot("buffer"),
  "buffer/": getNodePolyfillShimRoot("buffer"),
  "node:buffer": getNodePolyfillShimRoot("buffer"),
  "node:buffer/": getNodePolyfillShimRoot("buffer"),
  global: getNodePolyfillShimRoot("global"),
  "global/": getNodePolyfillShimRoot("global"),
  process: getNodePolyfillShimRoot("process"),
  "process/": getNodePolyfillShimRoot("process"),
  "node:process": getNodePolyfillShimRoot("process"),
  "node:process/": getNodePolyfillShimRoot("process"),
  "vite-plugin-node-polyfills/shims/buffer": getNodePolyfillShimRoot("buffer"),
  "vite-plugin-node-polyfills/shims/buffer/": getNodePolyfillShimRoot("buffer"),
  "vite-plugin-node-polyfills/shims/global": getNodePolyfillShimRoot("global"),
  "vite-plugin-node-polyfills/shims/global/": getNodePolyfillShimRoot("global"),
  "vite-plugin-node-polyfills/shims/process":
    getNodePolyfillShimRoot("process"),
  "vite-plugin-node-polyfills/shims/process/":
    getNodePolyfillShimRoot("process"),
} satisfies Record<string, string>;

const nodePolyfillShimInject = {
  Buffer: getNodePolyfillShim("buffer"),
  global: getNodePolyfillShim("global"),
  process: getNodePolyfillShim("process"),
} satisfies Record<string, string>;

const nodePolyfillShimAliasPlugin = (): Plugin => ({
  name: "stakekit-node-polyfill-shim-aliases",

  config() {
    return {
      optimizeDeps: {
        rolldownOptions: {
          resolve: {
            alias: nodePolyfillShimAliases,
          },
        },
      },
      resolve: {
        alias: nodePolyfillShimAliases,
      },
      build: {
        rolldownOptions: {
          transform: {
            inject: nodePolyfillShimInject,
          },
        },
      },
    };
  },
});

export const nodePolyfillOptimizeDeps = [
  "vite-plugin-node-polyfills/shims/buffer",
  "vite-plugin-node-polyfills/shims/global",
  "vite-plugin-node-polyfills/shims/process",
];

export const nodePolyfillPlugins = (): Plugin[] => [
  nodePolyfills(),
  nodePolyfillShimAliasPlugin(),
];
