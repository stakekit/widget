import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { IconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { callToAction } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";

/** An icon a button shows beside its label. `ArrowIcon` needs a direction, so buttons take the caret icons instead. */
export type ButtonIconName = Exclude<IconName, "ArrowIcon">;

export type ButtonVariant = keyof typeof buttonVariantStyles;
export type ButtonSize = keyof typeof buttonSizeStyles;

/** The visual props `Button` and `ButtonAnchor` share. */
export type ButtonLookProps = {
  readonly variant?: ButtonVariant;
  /** `cta` fills the width at the call-to-action height the Layout asks for. */
  readonly size?: ButtonSize;
  /** An icon before the label. */
  readonly iconStart?: ButtonIconName;
  /** An icon after the label. */
  readonly iconEnd?: ButtonIconName;
};

/** The class names of a button's look, for a `button` or an `a`. */
export const buttonLook = (variant: ButtonVariant, size: ButtonSize) =>
  stylex.props(
    buttonStyles.root,
    focusRingStyles.visible,
    buttonVariantStyles[variant],
    buttonSizeStyles[size]
  );

/** The label between the optional start and end icons. */
export const ButtonContent = ({
  size,
  iconStart,
  iconEnd,
  children,
}: {
  readonly size: ButtonSize;
  readonly iconStart: ButtonIconName | undefined;
  readonly iconEnd: ButtonIconName | undefined;
  readonly children: ReactNode;
}) => {
  const iconSize = size === "sm" || size === "md" ? "sm" : "md";

  return (
    <>
      {iconStart && <Icon name={iconStart} size={iconSize} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  );
};

const buttonStyles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[8],
    paddingBlock: 0,
    textDecoration: "none",
    alignItems: "center",
    boxSizing: "border-box",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontWeight: fontWeight.semibold,
    justifyContent: "center",
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
});

// Disabled buttons sit on the surface with muted text, which keeps their
// label legible (5.7:1 in light) while reading as unavailable.
const buttonVariantStyles = stylex.create({
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

const buttonSizeStyles = stylex.create({
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
    height: callToAction.height,
    width: "100%",
  },
});
