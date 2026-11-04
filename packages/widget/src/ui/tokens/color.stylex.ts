import * as stylex from "@stylexjs/stylex";

/**
 * The Color Roles every Design System part reads. The defaults are the light
 * scheme; `theme/color-schemes.ts` holds the dark one. StyleX names each
 * custom property `--sk` followed directly by a hash, a namespace apart from
 * the legacy `--sk-*` theme variables. The names are not a host contract.
 *
 * `info` and `infoSoft` derive from the accent: the accent's text and soft
 * tint, so informational text keeps the accent's contrast.
 */
export const color = stylex.defineVars({
  background: "#FFFFFF",
  surface: "#F4F4F6",
  surfaceHover: "#ECECEF",
  surfaceRaised: "#FFFFFF",
  border: "#E4E4E7",
  borderStrong: "#D4D4D8",
  text: "#18181B",
  textMuted: "#5F5F6B",
  textSubtle: "#8E8E99",
  accent: "#4A60FF",
  accentHover: "#3B50F0",
  onAccent: "#FFFFFF",
  accentSoft: "#EEF0FF",
  accentText: "#3448E6",
  success: "#116932",
  successSoft: "#E7F6EC",
  warning: "#93400A",
  warningSoft: "#FEF3E2",
  danger: "#B42318",
  dangerSoft: "#FDECEC",
  info: "#3448E6",
  infoSoft: "#EEF0FF",
  focusRing: "#4A60FF",
  scrim: "rgb(9 9 11 / 0.48)",
});
