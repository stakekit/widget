import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import type { BrowserConfigOptions } from "vitest/node";
import { getConfig } from "./vite.config.base.ts";

const browserTestPattern = "tests/**/*.browser.test.{ts,tsx}";
const domTestPattern = "tests/**/*.dom.test.{ts,tsx}";
const unitTestPatterns = ["tests/**/*.test.{ts,tsx}"] as const;
const inlineTestDependencies = [
  /@ledgerhq/,
  /@luno-kit/,
  /@solana\/wallet-adapter/,
  /@tronweb3/,
  /@zondax/,
];
const testCacheDir = (project: "browser" | "dom" | "unit") =>
  path.resolve(import.meta.dirname, "..", "node_modules", ".vite", project);

// Browser tests and Design System stories render in the same headless Chromium.
const chromium = {
  enabled: true,
  screenshotFailures: false,
  provider: playwright(),
  instances: [{ browser: "chromium" }],
  viewport: { width: 800, height: 900 },
  headless: true,
} satisfies BrowserConfigOptions;

export default defineConfig(
  getConfig(
    {
      // Every project's server takes this list. The Storybook plugin's setup
      // file lives in the workspace's pnpm store, outside the package root,
      // which Vite takes for the workspace root because its package.json
      // declares `workspaces`. Allow the package and the store, not the
      // whole monorepo.
      server: {
        fs: {
          allow: [
            path.resolve(import.meta.dirname, ".."),
            path.resolve(import.meta.dirname, "..", "..", "..", "node_modules"),
          ],
        },
      },
      test: {
        projects: [
          {
            extends: true,
            cacheDir: testCacheDir("unit"),
            test: {
              name: "unit",
              environment: "node",
              exclude: [browserTestPattern, domTestPattern],
              include: [...unitTestPatterns],
              testTimeout: 5_000,
              server: {
                deps: {
                  inline: inlineTestDependencies,
                },
              },
            },
          },
          {
            extends: true,
            cacheDir: testCacheDir("dom"),
            test: {
              name: "dom",
              environment: "jsdom",
              include: [domTestPattern],
              setupFiles: [
                path.resolve(
                  import.meta.dirname,
                  "..",
                  "tests/utils/setup.dom.ts"
                ),
              ],
              testTimeout: 10_000,
              server: {
                deps: {
                  inline: inlineTestDependencies,
                },
              },
            },
          },
          {
            extends: true,
            cacheDir: testCacheDir("browser"),
            // MSW's service worker script is test infrastructure: only the
            // browser tests serve it, never the playground or its builds.
            publicDir: path.resolve(
              import.meta.dirname,
              "..",
              "tests/mocks/public"
            ),
            test: {
              name: "browser",
              fileParallelism: false,
              include: [browserTestPattern],
              setupFiles: [
                path.resolve(
                  import.meta.dirname,
                  "..",
                  "tests/utils/setup.browser.ts"
                ),
              ],
              testTimeout: 20_000,
              browser: chromium,
            },
          },
          {
            // Every Design System story renders in Chromium and fails on an
            // accessibility violation, a failed play or a console error.
            extends: true,
            // The Storybook plugin sets its own cache directory.
            plugins: [
              storybookTest({
                configDir: path.resolve(
                  import.meta.dirname,
                  "..",
                  ".storybook"
                ),
              }),
            ],
            test: {
              name: "storybook",
              setupFiles: [
                path.resolve(
                  import.meta.dirname,
                  "..",
                  "tests/utils/setup.storybook.ts"
                ),
              ],
              browser: chromium,
            },
          },
        ],
      },
    },
    { stylexInjection: "runtime" }
  )
);
