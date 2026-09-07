import type { KnipConfig } from "knip";

export default {
  entry: [
    "src/index.package.ts!",
    "src/index.bundle.ts!",
    "src/public-api/index.package.ts!",
    "src/public-api/index.bundle.ts!",
    "vite/*.ts!",
    "tests/package-types/*.ts",
    "tests/utils/setup.browser.ts",
    "tests/utils/setup.dom.ts",
    "tests/**/*.test.ts",
    "tests/**/*.test.tsx",
  ],
  project: [
    "src/**/*.{ts,tsx}!",
    "scripts/**/*.{ts,mts}",
    "tests/**/*.{ts,tsx}",
    "vite/**/*.ts!",
  ],
  ignoreIssues: {
    "src/generated/**": ["exports", "types"],
  },
  ignoreDependencies: [
    "@effect/language-service",
    "@effect/openapi-generator",
    "@effect/platform-node",
    // Production imports of these packages come from bundled third-party code.
    // vite.config.package.ts checks they stay external; DOM tests use them directly.
    ...(process.argv.includes("--production")
      ? [
          "@radix-ui/react-dismissable-layer",
          "@radix-ui/react-focus-guards",
          "@radix-ui/react-focus-scope",
          "aria-hidden",
          "react-remove-scroll",
          "scheduler",
        ]
      : []),
  ],
} satisfies KnipConfig;
