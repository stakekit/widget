import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";

/** The color schemes the theme root applies. Light is the tokens' default. */
export type ColorScheme = "light" | "dark";

const darkColors = stylex.createTheme(color, {
  background: "#151517",
  surface: "#202024",
  surfaceHover: "#2A2A2F",
  surfaceRaised: "#26262B",
  border: "#2C2C31",
  borderStrong: "#3B3B42",
  text: "#F4F4F5",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",
  accent: "#4A60FF",
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
});

// In dark, the shell is outlined in the border role instead of casting a shadow.
const darkElevation = stylex.createTheme(elevation, {
  raised: "0 1px 2px rgb(0 0 0 / 0.4), 0 2px 6px rgb(0 0 0 / 0.32)",
  overlay: "0 12px 32px rgb(0 0 0 / 0.48)",
  shell: "0 0 0 1px #2C2C31",
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
