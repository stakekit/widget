import * as stylex from "@stylexjs/stylex";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";

/** The keyboard focus ring every control draws on `:focus-visible`. */
export const focusRingStyles = stylex.create({
  visible: {
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
});
