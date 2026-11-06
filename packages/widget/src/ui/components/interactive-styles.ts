import * as stylex from "@stylexjs/stylex";

import { focusRing, selectionRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";

/**
 * Shared by surfaces a user can press (cards and rows rendered as a button or
 * link): the native control reset, press feedback and the focus ring.
 * Selection is a ring inside the edge plus the accent tint, never a shadow;
 * focus is a ring outside the edge past a gap, so the two never look alike.
 * `inset` draws the focus ring inside the edge instead, as two lines and a
 * gap where the selection ring is one, for rows a scrolling list would clip;
 * a selected row that takes it takes `insetSelected` too.
 */
export const interactiveStyles = stylex.create({
  root: {
    textDecoration: "none",
    appearance: "none",
    color: "inherit",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "block",
    fontFamily: "inherit",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    textAlign: "start",
    transform: {
      default: "none",
      ":active:not(:disabled)": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty:
      "background-color, border-color, outline-color, transform",
    transitionTimingFunction: motion.easing,
    width: "100%",
  },
  // While focused, the two-line ring runs from the selection ring's offset:
  // its inner line is the selection ring and its outer line the focus ring
  // outside the edge, so the selection stays marked under the focus.
  selected: {
    backgroundColor: color.accentSoft,
    outlineColor: { default: color.accent, ":focus-visible": color.focusRing },
    outlineOffset: selectionRing.offset,
    outlineStyle: { default: "solid", ":focus-visible": focusRing.insetStyle },
    outlineWidth: {
      default: selectionRing.width,
      ":focus-visible": focusRing.insetWidth,
    },
  },
  // After `root`: the focus ring inside the edge.
  inset: {
    outlineOffset: focusRing.insetOffset,
    outlineStyle: { default: "none", ":focus-visible": focusRing.insetStyle },
    outlineWidth: focusRing.insetWidth,
  },
  // After `inset`, for a selected surface: the selection ring and tint, and
  // the inset focus ring in the ring's place while focused, its outer line
  // where the selection ring was and its inner line inside the tint.
  insetSelected: {
    backgroundColor: color.accentSoft,
    outlineColor: { default: color.accent, ":focus-visible": color.focusRing },
    outlineOffset: {
      default: selectionRing.offset,
      ":focus-visible": focusRing.insetOffset,
    },
    outlineStyle: { default: "solid", ":focus-visible": focusRing.insetStyle },
    outlineWidth: {
      default: selectionRing.width,
      ":focus-visible": focusRing.insetWidth,
    },
  },
});
