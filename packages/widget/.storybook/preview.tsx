import type { Decorator, Preview } from "@storybook/react-vite";
import {
  appearancePresets,
  type ColorScheme,
  resolveColorRoles,
  ThemeRoot,
} from "../src/ui/composition";

const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"];

/**
 * Themes the story with the toolbar's color scheme and Appearance Preset. The
 * theme root sets no visual property on the Widget root, so the canvas paints
 * the resolved background and text roles, as the Widget's shell does.
 */
const withTheme: Decorator = (Story, { globals }) => {
  const colorScheme =
    colorSchemes.find((scheme) => scheme === globals.colorScheme) ?? "light";
  const appearancePreset =
    appearancePresets.find((preset) => preset === globals.appearancePreset) ??
    "default";
  const roles = resolveColorRoles(colorScheme, appearancePreset);

  return (
    <div
      style={{
        background: roles.background,
        color: roles.text,
        minHeight: "100vh",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <ThemeRoot
        appearance={{}}
        appearancePreset={appearancePreset}
        callToActionSize="lg"
        colorScheme={colorScheme}
        portalContainer={undefined}
      >
        <Story />
      </ThemeRoot>
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    colorScheme: {
      description: "The color scheme the theme root applies",
      toolbar: {
        title: "Color scheme",
        icon: "mirror",
        items: [...colorSchemes],
        dynamicTitle: true,
      },
    },
    // Lists every Appearance Preset the Design System defines.
    appearancePreset: {
      description: "The Appearance Preset the theme root applies",
      toolbar: {
        title: "Appearance Preset",
        icon: "paintbrush",
        items: [...appearancePresets],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { colorScheme: "light", appearancePreset: "default" },
  parameters: {
    // The decorator paints the canvas edge to edge.
    layout: "fullscreen",
    // Accessibility violations fail the story's test.
    a11y: { test: "error" },
  },
};

export default preview;
