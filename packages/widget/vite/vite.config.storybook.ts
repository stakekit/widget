import { defineConfig } from "vite";

import { getConfig } from "./vite.config.base.ts";

// Storybook serves its own page, which never loads the dev server's StyleX
// stylesheet, so each module injects its rules as the tests do.
export default defineConfig(
  getConfig(undefined, { stylexInjection: "runtime" })
);
