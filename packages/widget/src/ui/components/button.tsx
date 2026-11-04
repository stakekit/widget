import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, Ref } from "react";
import { borderWidth } from "../tokens/border.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import {
  ButtonContent,
  type ButtonLookProps,
  buttonLook,
} from "./button-styles";

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style"
> &
  ButtonLookProps & {
    readonly ref?: Ref<HTMLButtonElement>;
    /** Shows a spinner beside the label and disables the button meanwhile. */
    readonly loading?: boolean;
  };

/**
 * A button. Its disabled look follows the native `disabled` state, and it
 * shows a focus ring when reached by keyboard. The `cta` size reads the
 * call-to-action height presentation setting.
 */
export const Button = ({
  variant = "secondary",
  size = "md",
  iconStart,
  iconEnd,
  loading = false,
  disabled = false,
  type = "button",
  children,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...buttonLook(variant, size)}
  >
    {loading && <span aria-hidden="true" {...stylex.props(styles.spinner)} />}
    <ButtonContent size={size} iconStart={iconStart} iconEnd={iconEnd}>
      {children}
    </ButtonContent>
  </button>
);

const styles = stylex.create({
  spinner: {
    borderColor: "currentColor",
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    animationDuration: motion.spin,
    animationIterationCount: "infinite",
    animationName: spin,
    animationTimingFunction: motion.linear,
    boxSizing: "border-box",
    flexShrink: 0,
    borderRightColor: "transparent",
    height: "1em",
    width: "1em",
  },
});
