import * as stylex from "@stylexjs/stylex";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

import { VisuallyHidden } from "../primitives/visually-hidden";
import { motionEasing, motionSeconds } from "../tokens/motion-timing";
import { useReducedMotion } from "./use-reduced-motion";

type AnimatedNumberProps = {
  readonly value: number;
  /**
   * Formats the digits of every value it passes through, such as "4.21".
   * Keep the decimal places fixed so the digits change count only when the
   * integer part does.
   */
  readonly format: (value: number) => string;
  /** Static text before the digits, such as a currency sign. */
  readonly prefix?: string;
  /** Static text after the digits, such as "%". */
  readonly suffix?: string;
};

/**
 * A number that counts to each new value, in tabular figures inside the
 * surrounding text. It shows its value at once when it mounts, so a screen
 * the user returns to never replays a count; only a change of value while it
 * shows counts. Only the digits change while it counts; the prefix and
 * suffix stay put and move only as the digits' width does. Under reduced
 * motion it shows the new value at once. Assistive technology reads only the
 * final value.
 */
export const AnimatedNumber = ({
  value,
  format,
  prefix = "",
  suffix = "",
}: AnimatedNumberProps) => {
  const reduceMotion = useReducedMotion();
  const current = useMotionValue(value);
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
      <span aria-hidden="true">
        {prefix && <span>{prefix}</span>}
        <motion.span>{shown}</motion.span>
        {suffix && <span>{suffix}</span>}
      </span>
      <VisuallyHidden>{`${prefix}${format(value)}${suffix}`}</VisuallyHidden>
    </span>
  );
};

const styles = stylex.create({
  root: { fontVariantNumeric: "tabular-nums" },
});
