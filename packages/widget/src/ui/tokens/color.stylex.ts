import * as stylex from "@stylexjs/stylex";

/**
 * The light scheme's Color Role values, which are the tokens' defaults.
 * `theme/color-schemes.ts` holds the dark ones. They are plain data, so theme
 * resolution, and the contrast test through it, reads the values the theme
 * applies.
 *
 * `info` and `infoSoft` derive from the accent: the accent's text and soft
 * tint, so informational text keeps the accent's contrast.
 */
export const lightColorRoles = {
  background: "#FFFFFF",
  // `surface` stands 1.16:1 off the canvas, so a filled card's edge reads
  // without a border of its own.
  surface: "#EEEEF1",
  surfaceHover: "#E6E6EA",
  surfaceRaised: "#FFFFFF",
  border: "#DFDFE4",
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
};

/** A Color Role's name. */
export type ColorRole = keyof typeof lightColorRoles;

/** A value for every Color Role. */
export type ColorRoles = Readonly<Record<ColorRole, string>>;

/**
 * The Color Roles every Design System part reads. StyleX names each custom
 * property `--sk` followed directly by a hash, a namespace apart from the
 * legacy `--sk-*` theme variables. The names are not a host contract.
 */
export const color = stylex.defineVars(lightColorRoles);

/**
 * How far a soft badge moves from `surface`, the fill of the rows and cards
 * it sits on, toward its tone's text color, as `color-mix` weights: a faint
 * `fill`, so the text keeps 4.5:1 on it, and a stronger 1px `edge` that sets
 * the badge off every surface. The neutral tone's text contrasts far more
 * with the surface than a status color does, so its edge, `neutralEdge`,
 * takes less of it to read as strongly. Mixed at paint time, they follow a
 * host's colors.
 */
export const badgeTint = stylex.defineConsts({
  fill: "8%",
  edge: "45%",
  neutralEdge: "25%",
});
