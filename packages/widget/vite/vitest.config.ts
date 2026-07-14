import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import { getConfig } from "./vite.config.base";

const browserTestPattern = "tests/**/*.browser.test.{ts,tsx}";
const domTestPattern = "tests/**/*.dom.test.{ts,tsx}";
const inlineTestDependencies = [
  /@ledgerhq/,
  /@luno-kit/,
  /@solana\/wallet-adapter/,
  /@tronweb3/,
  /@zondax/,
];

export default defineConfig(
  getConfig({
    test: {
      retry: process.env.CI ? 2 : 0,
      testTimeout: 60000,
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "node",
            exclude: [browserTestPattern, domTestPattern],
            include: ["tests/**/*.test.{ts,tsx}"],
            server: {
              deps: {
                inline: inlineTestDependencies,
              },
            },
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            include: [domTestPattern],
            setupFiles: [
              path.resolve(__dirname, "..", "tests/utils/setup.dom.ts"),
            ],
            server: {
              deps: {
                inline: inlineTestDependencies,
              },
            },
          },
        },
        {
          extends: true,
          test: {
            name: "browser",
            include: [browserTestPattern],
            setupFiles: [
              path.resolve(__dirname, "..", "tests/utils/setup.browser.ts"),
            ],
            browser: {
              enabled: true,
              screenshotFailures: false,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
              viewport: { width: 800, height: 900 },
              headless: true,
            },
          },
        },
      ],
    },
  })
);
