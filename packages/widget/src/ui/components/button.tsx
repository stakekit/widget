import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes } from "react";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { presentation } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

const spin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style"
> & {
  readonly variant?: keyof typeof variantStyles;
  /** `cta` fills the width at the call-to-action height the Layout asks for. */
  readonly size?: keyof typeof sizeStyles;
  /** Shows a spinner beside the label and disables the button meanwhile. */
  readonly loading?: boolean;
};

/**
 * A button. Its disabled look follows the native `disabled` state, and it
 * shows a focus ring when reached by keyboard.
 */
export const Button = ({
  variant = "secondary",
  size = "md",
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
    {...stylex.props(styles.root, variantStyles[variant], sizeStyles[size])}
  >
    {loading && <span aria-hidden="true" {...stylex.props(styles.spinner)} />}
    {children}
  </button>
);

const styles = stylex.create({
  root: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: 1,
    boxSizing: "border-box",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontWeight: fontWeight.semibold,
    gap: space[8],
    justifyContent: "center",
    margin: 0,
    outlineColor: color.focusRing,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    paddingBlock: 0,
    textAlign: "center",
    transform: {
      default: "none",
      ":active:not(:disabled)": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color, color, transform",
    transitionTimingFunction: motion.easing,
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  spinner: {
    animationDuration: motion.spin,
    animationIterationCount: "infinite",
    animationName: spin,
    animationTimingFunction: "linear",
    borderColor: "currentColor",
    borderRadius: radius.pill,
    borderRightColor: "transparent",
    borderStyle: "solid",
    borderWidth: 2,
    boxSizing: "border-box",
    flexShrink: 0,
    height: "1em",
    width: "1em",
  },
});

// Disabled buttons sit on the surface with muted text, which keeps their
// label legible (5.7:1 in light) while reading as unavailable.
const variantStyles = stylex.create({
  primary: {
    backgroundColor: {
      default: color.accent,
      ":hover:not(:disabled)": color.accentHover,
      ":disabled": color.surface,
    },
    color: { default: color.onAccent, ":disabled": color.textMuted },
  },
  secondary: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    borderColor: { default: color.borderStrong, ":disabled": color.border },
    color: { default: color.text, ":disabled": color.textMuted },
  },
  ghost: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: { default: color.text, ":disabled": color.textMuted },
  },
  // Status colors stay text on their soft tint; hover outlines the button.
  danger: {
    backgroundColor: { default: color.dangerSoft, ":disabled": color.surface },
    borderColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.danger,
    },
    color: { default: color.danger, ":disabled": color.textMuted },
  },
});

const sizeStyles = stylex.create({
  sm: {
    fontSize: fontSize.label,
    height: controlHeight.sm,
    lineHeight: lineHeight.label,
    paddingInline: space[12],
  },
  md: {
    fontSize: fontSize.body,
    height: controlHeight.md,
    lineHeight: lineHeight.body,
    paddingInline: space[16],
  },
  lg: {
    fontSize: fontSize.heading,
    height: controlHeight.lg,
    lineHeight: lineHeight.heading,
    paddingInline: space[20],
  },
  cta: {
    fontSize: fontSize.heading,
    height: presentation.callToActionHeight,
    lineHeight: lineHeight.heading,
    paddingInline: space[24],
    width: "100%",
  },
});
