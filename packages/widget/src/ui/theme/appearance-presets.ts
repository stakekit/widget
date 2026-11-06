import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import { type ColorRoles, color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { tokenTrigger } from "../tokens/token-trigger.stylex";
import { figureWeight, fontWeight } from "../tokens/typography.stylex";
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
 * and the themes it applies in any scheme, over the radius, weight, control
 * height and elevation variables. A preset with one palette fixes the color
 * scheme to it, whatever the host requests.
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

// Each preset's identity beyond its colors. Finery is airy: softer, larger
// radii and lighter headings. Porto is tight and flat: small radii, pill
// controls cornered as its controls, a lighter weight scale, and every raised
// part edged in a line instead of a shadow. Utila is crisp and compact: 8px
// radii on cards, controls, pill controls and overlays, shorter controls, and
// raised parts edged in its border over a faint shadow.
const fineryRadius = stylex.createTheme(radius, {
  badge: "8px",
  control: "14px",
  controlInner: "10px",
  card: "20px",
  overlay: "24px",
  shell: "24px",
});

const fineryFontWeight = stylex.createTheme(fontWeight, {
  semibold: "500",
});

// Big figures follow each preset's lighter semibold.
const fineryFigureWeight = stylex.createTheme(figureWeight, { display: "500" });

const portoRadius = stylex.createTheme(radius, {
  badge: "4px",
  control: "4px",
  controlInner: "2px",
  card: "6px",
  overlay: "8px",
  shell: "8px",
  pillControl: "4px",
});

const portoFontWeight = stylex.createTheme(fontWeight, {
  regular: "300",
  medium: "400",
  semibold: "500",
});

const portoFigureWeight = stylex.createTheme(figureWeight, { display: "500" });

// Applied after the dark scheme's elevation, which it replaces.
const portoElevation = stylex.createTheme(elevation, {
  raised: `0 0 0 1px ${color.borderStrong}`,
  overlay: `0 0 0 1px ${color.border}, 0 16px 40px rgb(0 0 0 / 0.6)`,
  shell: `0 0 0 1px ${color.border}`,
});

// Utila's corners and main button, as on `main`: 12px cards, a 14px frame,
// and a 40px call to action.
const utilaRadius = stylex.createTheme(radius, {
  badge: "4px",
  control: "8px",
  controlInner: "6px",
  card: "12px",
  overlay: "8px",
  shell: "14px",
  pillControl: "8px",
});

const utilaControlHeight = stylex.createTheme(controlHeight, {
  sm: "28px",
  md: "36px",
  lg: "40px",
});

const utilaElevation = stylex.createTheme(elevation, {
  raised: `0 0 0 1px ${color.border}, 0 1px 2px rgb(9 9 11 / 0.05)`,
  overlay: `0 0 0 1px ${color.border}, 0 12px 32px rgb(9 9 11 / 0.12)`,
  shell: `0 0 0 1px ${color.border}, 0 4px 16px rgb(9 9 11 / 0.05)`,
});

// The token trigger's look, set on the theme root with the preset's other
// themes: a variable referencing another resolves where it is declared, so
// the raised look picks up the scheme's and preset's fill and elevation only
// when declared beside them. Utila's trigger sits flat in its outlined cards,
// whose edge is the only one: it takes its card's fill, tints on hover, and
// rounds more than Utila's other controls.
const raisedTokenTrigger = stylex.createTheme(tokenTrigger, {
  fill: color.surfaceRaised,
  shadow: elevation.raised,
  radius: radius.pillControl,
});

const utilaTokenTrigger = stylex.createTheme(tokenTrigger, {
  fill: "transparent",
  shadow: "none",
  radius: "12px",
});

// Regular-weight amounts and rates over semibold headings, as Utila's own UI.
const utilaFigureWeight = stylex.createTheme(figureWeight, { display: "400" });

const presetDefinitions: Readonly<Record<AppearancePreset, PresetDefinition>> =
  {
    default: {
      palettes: { light: basePalette, dark: basePalette },
      theme: raisedTokenTrigger,
    },
    finery: {
      palettes: presetPalettes.finery,
      theme: [
        fineryRadius,
        fineryFontWeight,
        fineryFigureWeight,
        raisedTokenTrigger,
      ],
    },
    porto: {
      fixedColorScheme: "dark",
      palette: presetPalettes.porto.dark,
      theme: [
        portoRadius,
        portoFontWeight,
        portoFigureWeight,
        portoElevation,
        raisedTokenTrigger,
      ],
    },
    utila: {
      fixedColorScheme: "light",
      palette: presetPalettes.utila.light,
      theme: [
        utilaRadius,
        utilaControlHeight,
        utilaElevation,
        utilaTokenTrigger,
        utilaFigureWeight,
      ],
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
