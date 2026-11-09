import * as stylex from "@stylexjs/stylex";

/**
 * The light scheme's Color Role values, which are the tokens' defaults.
 * `theme/color-schemes.ts` holds the dark ones. They are plain data, so theme
 * resolution, and the contrast test through it, reads the values the theme
 * applies.
 *
 * The neutrals lean slightly toward the accent's blue, so greys and accent
 * read as one palette. `info` is a sky blue of its own, apart from the
 * accent, so an informational notice never reads as a selected control.
 */
export const lightColorRoles = {
  background: "#FFFFFF",
  // `surface` stands 1.16:1 off the canvas, so a filled card's edge reads
  // without a border of its own. `surfaceHover` stands 1.13:1 off `surface`,
  // so hover reads as a change, while the accent keeps 3.65:1 and muted text
  // 4.99:1 on it.
  surface: "#EDEEF3",
  surfaceHover: "#DFE1E9",
  surfaceRaised: "#FFFFFF",
  border: "#DDDFE7",
  borderStrong: "#D0D3DE",
  text: "#16171D",
  textMuted: "#5A5D6E",
  textSubtle: "#8A8D9E",
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
  info: "#0369A1",
  infoSoft: "#E0F2FE",
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

/**
 * How a filled button's fill changes while it is pressed, as `color-mix`
 * weights, on top of the press scale: the primary's hover fill takes `shade`
 * of `ink`, so it deepens past the hover; a soft fill (the soft and danger
 * buttons) takes `toneFill` of its label color, so it fills in toward the
 * label while the label keeps 4.5:1 on it (a host accent's derived text and
 * tint leave little room: 8% falls below it under Finery dark). Mixed at
 * paint time, they follow a host's colors.
 */
export const pressTint = stylex.defineConsts({
  shade: "10%",
  toneFill: "6%",
  ink: "#000000",
});

/**
 * How far a soft control's 1px edge (the soft button's, and the `Chip`'s)
 * moves from `surface`, the fill of the cards it sits on, toward its accent
 * label color, as a `color-mix` weight. Its `accentSoft` tint nearly matches
 * `surface` in every scheme, and a tint deep enough to stand off it would
 * drop the label below 4.5:1, so the edge bounds it, at least 1.5:1 on every
 * surface as a soft badge's is. Mixed at paint time, it follows a host's
 * colors.
 */
export const softControlTint = stylex.defineConsts({
  edge: "45%",
});
