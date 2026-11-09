import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // The Widget's Vite configuration, so stories compile StyleX like the
  // Widget does.
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: "vite/vite.config.storybook.ts" } },
  },
  // Storybook covers the Design System only; stories sit beside their parts.
  stories: ["../src/ui/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },
};

export default config;
