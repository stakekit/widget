import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes } from "react";
import { borderWidth, focusRing } from "../tokens/border.stylex";
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
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[8],
    paddingBlock: 0,
    alignItems: "center",
    boxSizing: "border-box",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontWeight: fontWeight.semibold,
    justifyContent: "center",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
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
    borderColor: { default: color.borderStrong, ":disabled": color.border },
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
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
    borderColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.danger,
    },
    backgroundColor: { default: color.dangerSoft, ":disabled": color.surface },
    color: { default: color.danger, ":disabled": color.textMuted },
  },
});

const sizeStyles = stylex.create({
  sm: {
    paddingInline: space[12],
    fontSize: fontSize.label,
    lineHeight: lineHeight.label,
    height: controlHeight.sm,
  },
  md: {
    paddingInline: space[16],
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    height: controlHeight.md,
  },
  lg: {
    paddingInline: space[20],
    fontSize: fontSize.heading,
    lineHeight: lineHeight.heading,
    height: controlHeight.lg,
  },
  cta: {
    paddingInline: space[24],
    fontSize: fontSize.heading,
    lineHeight: lineHeight.heading,
    height: presentation.callToActionHeight,
    width: "100%",
  },
});
