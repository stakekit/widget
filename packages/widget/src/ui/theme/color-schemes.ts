import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";

import {
  type ColorRoles,
  color,
  lightColorRoles,
} from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";

/** The color schemes the theme root applies. Light is the tokens' default. */
export type ColorScheme = "light" | "dark";

// The neutrals lean slightly toward the accent's blue, as in light.
// `surface` stands 1.16:1 off the canvas, so a filled card's edge reads, and
// `surfaceHover` 1.13:1 off `surface`, so hover reads as a change.
// `surfaceRaised` sits just above `surface`: in dark a shadow does not show,
// so the `raised` elevation outlines it instead (see `darkElevation`).
const darkColorRoles: ColorRoles = {
  background: "#0F1014",
  surface: "#1E1F27",
  surfaceHover: "#272932",
  surfaceRaised: "#23242D",
  border: "#2D2F39",
  borderStrong: "#3C3F4B",
  text: "#F3F4F7",
  textMuted: "#A1A3B3",
  textSubtle: "#6E7182",
  // 3.10:1 on `surfaceHover`, so a selected control's accent cue reads; the
  // greys above are as light as that allows. Hover deepens it (1.25:1 off the
  // accent) under the white text, which a lighter hover would drop below
  // 4.5:1.
  accent: "#4C62FF",
  accentHover: "#3B50F0",
  onAccent: "#FFFFFF",
  accentSoft: "#1E2238",
  accentText: "#9AA6FF",
  success: "#4ADE80",
  successSoft: "#16291E",
  warning: "#FBBF24",
  warningSoft: "#2E2614",
  danger: "#F87171",
  dangerSoft: "#2E1B1D",
  info: "#7DD3FC",
  infoSoft: "#0F2A3A",
  focusRing: "#8C9BFF",
  scrim: "rgb(0 0 0 / 0.64)",
};

const darkColors = stylex.createTheme(color, darkColorRoles);

// In dark, a shadow does not show on the canvas: the shell is outlined in
// the border role instead, a raised surface (a selected tab or segment, the
// token trigger, an elevated card) adds a `borderStrong` outline to its
// shadow, so it reads against the surface it sits on, and an overlay, such as
// a dialog over the scrim, is edged in `border` over its shadow.
const darkElevation = stylex.createTheme(elevation, {
  raised: `0 0 0 1px ${color.borderStrong}, 0 1px 2px rgb(0 0 0 / 0.4), 0 2px 6px rgb(0 0 0 / 0.32)`,
  overlay: `0 0 0 1px ${color.border}, 0 12px 32px rgb(0 0 0 / 0.48)`,
  shell: `0 0 0 1px ${color.border}`,
});

const schemeStyles = stylex.create({
  light: { colorScheme: "light" },
  dark: { colorScheme: "dark" },
});

/** Everything the theme root applies for a color scheme. */
export const colorSchemeThemes = {
  light: [schemeStyles.light],
  dark: [darkColors, darkElevation, schemeStyles.dark],
};

/** Every Color Role's value in each color scheme, before any preset. */
export const colorSchemeRoles: Readonly<Record<ColorScheme, ColorRoles>> = {
  light: lightColorRoles,
  dark: darkColorRoles,
};

/**
 * An Appearance Preset's palette in one color scheme: its Color Role values
 * and the StyleX theme that applies them, built from the same `const`, so the
 * values the contrast test reads are the ones the theme root applies.
 */
export type PresetPalette = Readonly<{
  colors: Partial<ColorRoles>;
  theme: StyleXArray<CompiledStyles | null>;
}>;

// Preset palettes live beside the schemes' roles because a theme replaces
// any other theme over the same variables on an element: a dark palette's
// theme replaces the dark scheme's, so it is built over every dark role, and
// StyleX reads only values declared in this module. Light palettes override
// the defaults the variables declare, so they list only what they change.

// Finery: elevated and airy. Its neutrals are tinted toward its teal, and
// white cards lift off a near-white canvas on a soft, teal-tinted shadow
// (`fineryLightElevation`). The teal accent is too light for white text, so
// `onAccent` is dark. In light, its brand teal (#16C7B0) is darkened to
// #119A88 (same hue), the lightest that still marks a selected control at 3:1
// on every surface (3.02:1 on `surfaceHover`, which is as deep as its tinted
// greys go) while keeping dark text at 5.06:1; hover lightens under the dark
// text, 1.26:1 off the accent (6.37:1). Its accent text and focus ring are a
// deeper teal in light.
// Its dark surfaces sit closer to the canvas than its translucent greys, with
// white text, so text derived from a host accent keeps its contrast on them;
// its dark hover stands 1.13:1 off them. Its danger is lighter than the dark
// scheme's, which reads 4.11:1 on its hover surface. Its `info` is a blue
// set apart from the teal, deeper in light. Its light text stays the neutral
// near-black rather than the default's blue-leaning one.
const fineryLightColors = {
  background: "#FCFDFD",
  surface: "#EEF5F3",
  surfaceHover: "#E7F0EE",
  surfaceRaised: "#FFFFFF",
  border: "#DCE7E4",
  borderStrong: "#C8D8D4",
  text: "#18181B",
  textMuted: "#566664",
  textSubtle: "#879593",
  accent: "#119A88",
  accentHover: "#14AE9A",
  onAccent: "#18181B",
  accentSoft: "#EBF9F7",
  accentText: "#0B7468",
  info: "#1360A0",
  infoSoft: "#E6F0FA",
  focusRing: "#0B7468",
};

// A wide, faint shadow in the teal's shade, so a card floats rather than
// sits; the dark scheme's outlined elevation stays in dark.
const fineryLightElevation = stylex.createTheme(elevation, {
  raised: "0 1px 2px rgb(16 56 50 / 0.04), 0 6px 20px rgb(16 56 50 / 0.07)",
  overlay: "0 16px 48px rgb(16 56 50 / 0.16)",
  shell: "0 12px 40px rgb(16 56 50 / 0.10)",
});

const fineryLightColorTheme = stylex.createTheme(color, fineryLightColors);

const fineryLightTheme = [fineryLightColorTheme, fineryLightElevation];

const fineryDarkColors = {
  background: "#243034",
  surface: "#2B373B",
  surfaceHover: "#333F44",
  surfaceRaised: "#2B373B",
  text: "#FFFFFF",
  border: "#3A464A",
  borderStrong: "#4D5A5E",
  textMuted: "#C4C8CB",
  textSubtle: "#98A0A4",
  accent: "#16C7B0",
  accentHover: "#3DD6C1",
  onAccent: "#122024",
  accentSoft: "#233C3E",
  accentText: "#5EE3D0",
  info: "#8CCBF7",
  infoSoft: "#1E344C",
  focusRing: "#16C7B0",
  danger: "#FC9090",
};

const fineryDarkTheme = stylex.createTheme(color, {
  ...darkColorRoles,
  ...fineryDarkColors,
});

// Porto: dark only and high contrast: a near-black canvas, white text, and
// flat surfaces edged in `border` rather than shadowed (`portoElevation`).
// Its lavender accent is too light for white text (2.48:1), so `onAccent` is
// dark; its soft tint and accent text are lavender too, and its `info` the
// dark scheme's sky blue, apart from the lavender.
const portoColors = {
  background: "#0F0F10",
  surface: "#1F1F21",
  surfaceHover: "#2A2A2D",
  surfaceRaised: "#1F1F21",
  border: "#343438",
  borderStrong: "#4A4A50",
  text: "#FFFFFF",
  textMuted: "#B4B5C3",
  textSubtle: "#8A8B9C",
  accent: "#AB95FF",
  accentHover: "#BDA8FF",
  onAccent: "#171717",
  accentSoft: "#2D2649",
  accentText: "#AB95FF",
  info: "#7DD3FC",
  infoSoft: "#0F2A3A",
  focusRing: "#AB95FF",
};

const portoTheme = stylex.createTheme(color, {
  ...darkColorRoles,
  ...portoColors,
});

// Utila: light only, on Utila's own palette exactly as it ships on `main`:
// the default accent on its `#F5F5F6` grey and `#E4E4E7` lines, `#C9CFFF`
// around inputs, `#373737` text, `#999999` secondary text and `#5C70FF` on
// its light accent chips, with informational text in the accent's text
// color. Its secondary text and accent chips read below WCAG AA; the
// contrast test exempts Utila by the product's choice. It also sets the roles
// the light defaults have since moved away from (`textSubtle`, `info`), so it
// still ships as on `main`.
const utilaColors = {
  background: "#FFFFFF",
  surface: "#F5F5F6",
  surfaceHover: "#EDEDEF",
  border: "#E4E4E7",
  borderStrong: "#C9CFFF",
  text: "#373737",
  textMuted: "#999999",
  textSubtle: "#8E8E99",
  accentSoft: "#F4F5FF",
  accentText: "#5C70FF",
  info: "#3448E6",
  infoSoft: "#F4F5FF",
  warningSoft: "#FFE9BD",
};

const utilaTheme = stylex.createTheme(color, utilaColors);

/** Each Appearance Preset's palettes, by the color schemes it supports. */
export const presetPalettes = {
  finery: {
    light: { colors: fineryLightColors, theme: fineryLightTheme },
    dark: { colors: fineryDarkColors, theme: fineryDarkTheme },
  },
  porto: { dark: { colors: portoColors, theme: portoTheme } },
  utila: { light: { colors: utilaColors, theme: utilaTheme } },
} satisfies Readonly<
  Record<string, Partial<Record<ColorScheme, PresetPalette>>>
>;
