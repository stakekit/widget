import * as stylex from "@stylexjs/stylex";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { font, fontSize, lineHeight } from "../tokens/typography.stylex";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/**
 * Shared by popups that open from a control (Select, Menu, Popover, InfoTip):
 * the raised surface that fades in and out with Base UI's starting and ending
 * style attributes, and the highlighted row of a list inside it. A row draws
 * its focus ring inside its edge, where the scrolling list cannot clip it.
 */
export const popupStyles = stylex.create({
  positioner: { outlineStyle: "none" },
  surface: {
    borderColor: color.border,
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    backgroundColor: color.surfaceRaised,
    boxShadow: elevation.overlay,
    boxSizing: "border-box",
    color: color.text,
    fontFamily: font.sans,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    opacity: { default: 1, [enteringOrLeaving]: 0 },
    outlineStyle: "none",
    transitionDuration: motion.fast,
    transitionProperty: "opacity",
    transitionTimingFunction: motion.easing,
  },
  // A popup that holds text rather than a list: a popover or an info tip.
  panel: {
    padding: space[12],
    gap: space[4],
    display: "flex",
    flexDirection: "column",
    maxWidth: `min(var(--available-width), ${overlaySize.popoverMaxWidth})`,
  },
  item: {
    borderRadius: radius.controlInner,
    gap: space[8],
    paddingBlock: space[8],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":is([data-highlighted])": color.surfaceHover,
    },
    color: { default: color.text, ":is([data-disabled])": color.textSubtle },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "flex",
    outlineColor: color.focusRing,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    userSelect: "none",
  },
});
