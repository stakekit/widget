import * as stylex from "@stylexjs/stylex";
import { focusRing, selectionRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";

/**
 * Shared by surfaces a user can press (cards and rows rendered as a button or
 * link): the native control reset, press feedback and the focus ring.
 * Selection is a ring plus the accent tint, never a shadow.
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
  // The focus ring replaces the selection ring while the surface has focus.
  selected: {
    backgroundColor: color.accentSoft,
    outlineColor: { default: color.accent, ":focus-visible": color.focusRing },
    outlineOffset: {
      default: selectionRing.offset,
      ":focus-visible": focusRing.offset,
    },
    outlineStyle: "solid",
    outlineWidth: selectionRing.width,
  },
});
