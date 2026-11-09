import * as stylex from "@stylexjs/stylex";

import { color } from "./color.stylex";
import { elevation } from "./elevation.stylex";
import { radius } from "./radius.stylex";

/**
 * The token trigger's look beside an amount: its fill, its lift off the card
 * and its corners. By default it is a pill on `surfaceRaised`, raised as any
 * raised part is; a preset can set it flat in its card instead, taking the
 * card's fill and tinting on hover only. Every preset sets these on the
 * theme root (`theme/appearance-presets.ts`): these defaults resolve once, at
 * `:root`, outside any scheme or preset.
 */
export const tokenTrigger = stylex.defineVars({
  fill: color.surfaceRaised,
  shadow: elevation.raised,
  radius: radius.pillControl,
});
