import * as stylex from "@stylexjs/stylex";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";

/**
 * The keyboard focus ring every control draws on `:focus-visible`: a line
 * outside the edge past a gap, so it never reads as a selection ring.
 * `inset`, applied after `visible`, draws the line just inside the edge, for
 * full-width parts and parts at a scrolling container's edge, which would cut
 * it off, that are never marked by a selection ring, such as a tab or a
 * disclosure. A surface that can be selected draws its inside focus ring as
 * two lines instead (`interactiveStyles.inset`).
 */
export const focusRingStyles = stylex.create({
  visible: {
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
  inset: { outlineOffset: `calc(-1 * ${focusRing.width})` },
});
