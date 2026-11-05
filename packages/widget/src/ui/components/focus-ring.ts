import * as stylex from "@stylexjs/stylex";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";

/**
 * The keyboard focus ring every control draws on `:focus-visible`. `inset`,
 * applied after `visible`, draws it inside the edge, for full-width parts and
 * parts at a scrolling container's edge, which would cut it off.
 */
export const focusRingStyles = stylex.create({
  visible: {
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
  inset: { outlineOffset: focusRing.insetOffset },
});
