import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/**
 * Shared by `Disclosure` and `Accordion`: the full-width trigger with a caret
 * that turns while open, and the panel that opens to its content's height.
 */
export const disclosureStyles = stylex.create({
  trigger: {
    margin: 0,
    borderRadius: radius.badge,
    borderStyle: "none",
    gap: space[8],
    paddingBlock: space[8],
    paddingInline: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: { default: color.text, ":disabled": color.textMuted },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "flex",
    fontFamily: font.sans,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    justifyContent: "space-between",
    lineHeight: lineHeight.body,
    textAlign: "start",
    width: "100%",
  },
  caret: {
    color: color.textMuted,
    display: "flex",
    transform: {
      default: "none",
      ":is([data-panel-open] > *)": "rotate(180deg)",
    },
    transitionDuration: motion.base,
    transitionProperty: "transform",
    transitionTimingFunction: motion.easing,
  },
  panel: {
    overflow: "hidden",
    opacity: { default: 1, [enteringOrLeaving]: 0 },
    transitionDuration: motion.base,
    transitionProperty: "height, opacity",
    transitionTimingFunction: motion.easing,
  },
  content: { paddingBottom: space[8] },
});
