import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import { type ColorRoles, color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { controlRadius, radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { tokenTrigger } from "../tokens/token-trigger.stylex";
import {
  figureWeight,
  font,
  fontWeight,
  roleWeight,
} from "../tokens/typography.stylex";
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
 * and the themes it applies in any scheme, over the radius, font, weight,
 * control height and elevation variables. A preset with one palette fixes the
 * color scheme to it, whatever the host requests.
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
// radii, lighter headings and a humanist sans. Porto is tight and flat: small
// radii, pill controls cornered as its controls, a lighter weight scale, a
// geometric sans over monospace figures, and every raised part edged in a
// line instead of a shadow. Utila is crisp and compact: 8px radii on cards,
// controls, pill controls and overlays, shorter controls, and raised parts
// edged in its border over a faint shadow. The fonts are system stacks; a
// host's `font` replaces them (see `appearanceProperties`).
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

const finerySans =
  'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif';

const fineryFont = stylex.createTheme(font, {
  sans: finerySans,
  figure: finerySans,
});

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

const portoFont = stylex.createTheme(font, {
  sans: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif',
  figure: font.mono,
});

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

// The heading role's weight, from the preset's or host's scale: set on the
// theme root beside it, as a variable referencing another resolves where it
// is declared. Headings sit a step under titles; Utila keeps them semibold,
// as it ships.
const mediumHeading = stylex.createTheme(roleWeight, {
  heading: fontWeight.medium,
});

const semiboldHeading = stylex.createTheme(roleWeight, {
  heading: fontWeight.semibold,
});

// A button's corners by its size, from the preset's or host's `control`
// radius: set on the theme root beside them, as a variable referencing
// another resolves where it is declared.
const sizedControlRadius = stylex.createTheme(controlRadius, {
  sm: `calc(${radius.control} * 2 / 3)`,
  md: `calc(${radius.control} * 5 / 6)`,
  lg: radius.control,
});

const presetDefinitions: Readonly<Record<AppearancePreset, PresetDefinition>> =
  {
    default: {
      palettes: { light: basePalette, dark: basePalette },
      theme: [raisedTokenTrigger, sizedControlRadius, mediumHeading],
    },
    finery: {
      palettes: presetPalettes.finery,
      theme: [
        fineryRadius,
        fineryFontWeight,
        fineryFigureWeight,
        fineryFont,
        raisedTokenTrigger,
        sizedControlRadius,
        mediumHeading,
      ],
    },
    porto: {
      fixedColorScheme: "dark",
      palette: presetPalettes.porto.dark,
      theme: [
        portoRadius,
        portoFontWeight,
        portoFigureWeight,
        portoFont,
        portoElevation,
        raisedTokenTrigger,
        sizedControlRadius,
        mediumHeading,
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
        sizedControlRadius,
        semiboldHeading,
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
