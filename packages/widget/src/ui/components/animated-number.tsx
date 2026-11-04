import * as stylex from "@stylexjs/stylex";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { motionEasing, motionSeconds } from "../tokens/motion-timing";
import { useReducedMotion } from "./use-reduced-motion";

type AnimatedNumberProps = {
  readonly value: number;
  /** Formats every value it passes through, such as "4.21%". */
  readonly format: (value: number) => string;
  /** Counts up from this value on mount; unset, the value shows at once. */
  readonly initial?: number;
};

/**
 * A number that counts to each new value, formatted at every step, in
 * tabular figures inside the surrounding text. Under reduced motion it shows
 * the new value at once. Assistive technology reads only the final value.
 */
export const AnimatedNumber = ({
  value,
  format,
  initial,
}: AnimatedNumberProps) => {
  const reduceMotion = useReducedMotion();
  const current = useMotionValue(reduceMotion ? value : (initial ?? value));
  const shown = useTransform(current, format);

  useEffect(() => {
    if (reduceMotion) {
      current.jump(value);
      return;
    }
    const animation = animate(current, value, {
      duration: motionSeconds.count,
      ease: motionEasing,
    });
    return () => animation.stop();
  }, [current, reduceMotion, value]);

  return (
    <span {...stylex.props(styles.root)}>
      <motion.span aria-hidden="true">{shown}</motion.span>
      <VisuallyHidden>{format(value)}</VisuallyHidden>
    </span>
  );
};

const styles = stylex.create({
  root: { fontVariantNumeric: "tabular-nums" },
});
