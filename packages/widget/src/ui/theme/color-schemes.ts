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

// `surface` stands 1.21:1 off the canvas, so a filled card's edge reads.
// `surfaceRaised` sits just above `surface`: in dark a shadow does not show,
// so the `raised` elevation outlines it instead (see `darkElevation`).
const darkColorRoles: ColorRoles = {
  background: "#111113",
  surface: "#232328",
  surfaceHover: "#2B2B31",
  surfaceRaised: "#28282D",
  border: "#303036",
  borderStrong: "#3F3F47",
  text: "#F4F4F5",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",
  // 3.01:1 on `surfaceHover`, so a selected control's accent cue reads; the
  // greys above are as light as that allows.
  accent: "#4C62FF",
  accentHover: "#4F64FF",
  onAccent: "#FFFFFF",
  accentSoft: "#1E2238",
  accentText: "#9AA6FF",
  success: "#4ADE80",
  successSoft: "#16291E",
  warning: "#FBBF24",
  warningSoft: "#2E2614",
  danger: "#F87171",
  dangerSoft: "#2E1B1D",
  info: "#9AA6FF",
  infoSoft: "#1E2238",
  focusRing: "#8C9BFF",
  scrim: "rgb(0 0 0 / 0.64)",
};

const darkColors = stylex.createTheme(color, darkColorRoles);

// In dark, a shadow does not show on the canvas: the shell is outlined in
// the border role instead, and a raised surface (a selected tab or segment,
// the token trigger, an elevated card) adds a `borderStrong` outline to its
// shadow, so it reads against the surface it sits on.
const darkElevation = stylex.createTheme(elevation, {
  raised: `0 0 0 1px ${color.borderStrong}, 0 1px 2px rgb(0 0 0 / 0.4), 0 2px 6px rgb(0 0 0 / 0.32)`,
  overlay: "0 12px 32px rgb(0 0 0 / 0.48)",
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

// Finery: a teal accent, too light for white text, so `onAccent` is dark. In
// light, its brand teal (#16C7B0) is darkened to #119A88 (same hue), the
// lightest that still marks a selected control at 3:1 on every surface
// (3.02:1 on `surfaceHover`) while keeping dark text at 5.06:1; hover
// lightens under the dark text (5.50:1). Its accent text and focus ring are
// a deeper teal in light. Its light greys are its translucent ones
// composited over its canvas, so contrast reads the colors the browser
// paints. Its dark surfaces sit closer to the canvas than its translucent
// greys, with white text, so text derived from a host accent keeps its
// contrast on them. Its danger is lighter than the dark scheme's, which
// reads 4.11:1 on its hover surface.
const fineryLightColors = {
  background: "#FDFDFD",
  surface: "#F5F5F5",
  surfaceHover: "#EEEEEE",
  surfaceRaised: "#FFFFFF",
  accent: "#119A88",
  accentHover: "#12A18E",
  onAccent: "#18181B",
  accentSoft: "#EBF9F7",
  accentText: "#0B7468",
  info: "#0B7468",
  infoSoft: "#EBF9F7",
  focusRing: "#0B7468",
};

const fineryLightTheme = stylex.createTheme(color, fineryLightColors);

const fineryDarkColors = {
  background: "#243034",
  surface: "#2B373B",
  surfaceHover: "#303C40",
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
  info: "#5EE3D0",
  infoSoft: "#233C3E",
  focusRing: "#16C7B0",
  danger: "#FC9090",
};

const fineryDarkTheme = stylex.createTheme(color, {
  ...darkColorRoles,
  ...fineryDarkColors,
});

// Porto: dark only, with a lavender accent too light for white text
// (2.48:1), so `onAccent` is dark.
const portoColors = {
  background: "#171717",
  surface: "#282828",
  surfaceHover: "#333333",
  surfaceRaised: "#282828",
  border: "#333333",
  borderStrong: "#3F3F3F",
  textMuted: "#A3A5B5",
  textSubtle: "#87899C",
  accent: "#AB95FF",
  accentHover: "#BDA8FF",
  onAccent: "#171717",
  accentSoft: "#2B2640",
  accentText: "#AB95FF",
  info: "#AB95FF",
  infoSoft: "#2B2640",
  focusRing: "#AB95FF",
};

const portoTheme = stylex.createTheme(color, {
  ...darkColorRoles,
  ...portoColors,
});

// Utila: light only, the default accent and surface on its greys.
const utilaColors = {
  border: "#E4E4E7",
  borderStrong: "#C9CFFF",
  accentSoft: "#F4F5FF",
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
