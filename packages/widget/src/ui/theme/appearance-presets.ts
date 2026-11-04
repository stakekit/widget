import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import type { ColorRoles } from "../tokens/color.stylex";
import { type ColorScheme, colorSchemeRoles } from "./color-schemes";

/**
 * The Appearance Presets a Host Profile can name. `default` sets no values:
 * it is the base color scheme.
 */
export const appearancePresets = ["default"] as const;

export type AppearancePreset = (typeof appearancePresets)[number];

type PresetValues = {
  /** The Color Role values the preset sets over each color scheme. */
  readonly colors: Readonly<Record<ColorScheme, Partial<ColorRoles>>>;
  /** The StyleX themes that apply those values, per color scheme. */
  readonly themes: Readonly<
    Record<ColorScheme, StyleXArray<CompiledStyles | null>>
  >;
};

const presetValues: Readonly<Record<AppearancePreset, PresetValues>> = {
  default: {
    colors: { light: {}, dark: {} },
    themes: { light: null, dark: null },
  },
};

/** The themes the theme root applies for a preset in a color scheme. */
export const appearancePresetThemes = (
  preset: AppearancePreset,
  colorScheme: ColorScheme
) => presetValues[preset].themes[colorScheme];

/** Every Color Role's value for a color scheme and Appearance Preset. */
export const resolveColorRoles = (
  colorScheme: ColorScheme,
  preset: AppearancePreset
): ColorRoles => ({
  ...colorSchemeRoles[colorScheme],
  ...presetValues[preset].colors[colorScheme],
});
