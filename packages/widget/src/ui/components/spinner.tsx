import * as stylex from "@stylexjs/stylex";

import { type TextTone, textToneStyles } from "../primitives/text-tone";
import { borderWidth } from "../tokens/border.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { iconSize } from "../tokens/size.stylex";

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

/**
 * A turning ring for work in progress, at an icon size. With `label` it is a
 * status that names the work; without it, it is decorative.
 */
export const Spinner = ({
  size = "md",
  tone,
  label,
}: {
  readonly size?: keyof typeof sizeStyles;
  /** Unset draws in the surrounding text color. */
  readonly tone?: TextTone;
  readonly label?: string;
}) => (
  <span
    {...(label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ role: "status", "aria-label": label } as const))}
    {...stylex.props(
      styles.root,
      sizeStyles[size],
      tone && textToneStyles[tone]
    )}
  />
);

const styles = stylex.create({
  root: {
    borderColor: "currentColor",
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    animationDuration: motion.spin,
    animationIterationCount: "infinite",
    animationName: spin,
    animationTimingFunction: motion.linear,
    boxSizing: "border-box",
    display: "inline-block",
    flexShrink: 0,
    borderRightColor: "transparent",
  },
});

const sizeStyles = stylex.create({
  sm: { height: iconSize.sm, width: iconSize.sm },
  md: { height: iconSize.md, width: iconSize.md },
  lg: { height: iconSize.lg, width: iconSize.lg },
});
