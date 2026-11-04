import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import type { ColorRoles } from "../tokens/color.stylex";
import { applyHostColors } from "./appearance";
import { type ColorScheme, colorSchemeRoles } from "./color-schemes";

/**
 * The Appearance Presets a Host Profile can name. `default` sets no values:
 * it is the base color scheme.
 */
export const appearancePresets = ["default"] as const;

export type AppearancePreset = (typeof appearancePresets)[number];

/**
 * What a preset sets over one color scheme: its Color Role values and the
 * StyleX theme that applies them. Build the theme from the same `const` as
 * `colors` (`stylex.createTheme(color, presetColors)`, bound to its own
 * top-level variable), so the values the contrast test reads are the ones
 * the theme root applies.
 */
type PresetScheme = Readonly<{
  colors: Partial<ColorRoles>;
  theme: StyleXArray<CompiledStyles | null>;
}>;

const unchangedScheme: PresetScheme = { colors: {}, theme: null };

const presetValues: Readonly<
  Record<AppearancePreset, Readonly<Record<ColorScheme, PresetScheme>>>
> = {
  default: { light: unchangedScheme, dark: unchangedScheme },
};

/** The themes the theme root applies for a preset in a color scheme. */
export const appearancePresetThemes = (
  preset: AppearancePreset,
  colorScheme: ColorScheme
) => presetValues[preset][colorScheme].theme;

/**
 * Every Color Role's value for a color scheme and Appearance Preset, with a
 * host's colors and the roles derived from them on top.
 */
export const resolveColorRoles = (
  colorScheme: ColorScheme,
  preset: AppearancePreset,
  hostColors: Partial<ColorRoles> = {}
): ColorRoles =>
  applyHostColors(
    colorScheme,
    {
      ...colorSchemeRoles[colorScheme],
      ...presetValues[preset][colorScheme].colors,
    },
    hostColors
  );
