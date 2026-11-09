import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/** Shared by `Modal` and `AlertDialog`: the scrim that fades in behind them. */
export const dialogStyles = stylex.create({
  backdrop: {
    inset: 0,
    backgroundColor: color.scrim,
    opacity: { default: 1, [enteringOrLeaving]: 0 },
    position: "fixed",
    transitionDuration: motion.base,
    transitionProperty: "opacity",
    transitionTimingFunction: motion.easing,
    zIndex: layer.modal,
  },
});
