import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import type { ColorRoles } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { fontWeight } from "../tokens/typography.stylex";
import { applyHostColors } from "./appearance";
import {
  type ColorScheme,
  colorSchemeRoles,
  type PresetPalette,
  presetPalettes,
} from "./color-schemes";

/**
 * The Appearance Presets a Host Profile can name. `default` sets no values:
 * it is the base color scheme.
 */
export const appearancePresets = [
  "default",
  "finery",
  "porto",
  "utila",
] as const;

export type AppearancePreset = (typeof appearancePresets)[number];

type PresetTheme = StyleXArray<CompiledStyles | null>;

/**
 * A preset's values: a palette per color scheme it supports (in
 * `color-schemes.ts`, beside the schemes' roles its dark palettes build on)
 * and the themes it applies in any scheme, over the radius and weight
 * variables. A preset with one palette fixes the color scheme to it, whatever
 * the host requests.
 */
type PresetDefinition = Readonly<{ theme: PresetTheme }> &
  (
    | Readonly<{
        fixedColorScheme?: undefined;
        palettes: Readonly<Record<ColorScheme, PresetPalette>>;
      }>
    | Readonly<{ fixedColorScheme: ColorScheme; palette: PresetPalette }>
  );

const basePalette: PresetPalette = { colors: {}, theme: null };

const portoRadius = stylex.createTheme(radius, {
  control: "8px",
  card: "8px",
});

// Porto's lighter weight scale.
const portoFontWeight = stylex.createTheme(fontWeight, {
  regular: "300",
  medium: "400",
  semibold: "500",
});

const utilaRadius = stylex.createTheme(radius, {
  control: "8px",
  card: "8px",
});

const presetDefinitions: Readonly<Record<AppearancePreset, PresetDefinition>> =
  {
    default: {
      palettes: { light: basePalette, dark: basePalette },
      theme: null,
    },
    finery: { palettes: presetPalettes.finery, theme: null },
    porto: {
      fixedColorScheme: "dark",
      palette: presetPalettes.porto.dark,
      theme: [portoRadius, portoFontWeight],
    },
    utila: {
      fixedColorScheme: "light",
      palette: presetPalettes.utila.light,
      theme: utilaRadius,
    },
  };

/**
 * The color scheme a preset presents for the one a host requests: the
 * request, unless the preset fixes the scheme.
 */
export const presetColorScheme = (
  preset: AppearancePreset,
  requested: ColorScheme
): ColorScheme => presetDefinitions[preset].fixedColorScheme ?? requested;

const presetPalette = (
  preset: AppearancePreset,
  colorScheme: ColorScheme
): PresetPalette => {
  const definition = presetDefinitions[preset];
  return definition.fixedColorScheme === undefined
    ? definition.palettes[colorScheme]
    : definition.palette;
};

/**
 * The themes the theme root applies for a preset in the color scheme the
 * preset presents (see `presetColorScheme`), after the scheme's own themes.
 */
export const appearancePresetThemes = (
  preset: AppearancePreset,
  colorScheme: ColorScheme
): PresetTheme => [
  presetDefinitions[preset].theme,
  presetPalette(preset, colorScheme).theme,
];

/**
 * Every Color Role's value for a requested color scheme and Appearance
 * Preset, in the scheme the preset presents, with a host's colors and the
 * roles derived from them on top.
 */
export const resolveColorRoles = (
  requestedColorScheme: ColorScheme,
  preset: AppearancePreset,
  hostColors: Partial<ColorRoles> = {}
): ColorRoles => {
  const colorScheme = presetColorScheme(preset, requestedColorScheme);
  return applyHostColors(
    colorScheme,
    {
      ...colorSchemeRoles[colorScheme],
      ...presetPalette(preset, colorScheme).colors,
    },
    hostColors
  );
};
