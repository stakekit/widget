import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
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

export type ButtonVariant = keyof typeof buttonVariantStyles;
export type ButtonSize = keyof typeof buttonSizeStyles;

/** The visual props `Button` and a button-look `ExternalLink` share. */
export type ButtonLookProps = {
  /**
   * `dangerOutline` is a secondary button drawn in the danger color, label
   * and edge, for a destructive action beside a secondary one, such as
   * disconnecting. `soft` is the accent text on its soft tint, for an action
   * on a filled surface that a secondary button's fill would vanish into,
   * such as an `ActionCard`'s.
   */
  readonly variant?: ButtonVariant;
  /** `cta` fills the width at the call-to-action height the Layout asks for. */
  readonly size?: ButtonSize;
  /** An icon before the label. */
  readonly iconStart?: FixedIconName;
  /** An icon after the label. */
  readonly iconEnd?: FixedIconName;
  /**
   * Shares a wrapping row (a `Stack` with `wrap` and `gap={8}`) with one
   * sibling action: each takes half when both labels fit in half, else each
   * takes its own full-width line.
   */
  readonly share?: boolean;
};

/** The class names of a button's look, for a `button` or an `a`. */
export const buttonLook = (
  variant: ButtonVariant,
  size: ButtonSize,
  share: boolean
) =>
  stylex.props(
    buttonStyles.root,
    focusRingStyles.visible,
    buttonVariantStyles[variant],
    buttonSizeStyles[size],
    share && buttonStyles.share
  );

/**
 * The label between the optional start and end icons. `iconEndLabel` names
 * the end icon, such as a new-tab marker; unset, the icons are decorative.
 */
export const ButtonContent = ({
  size,
  iconStart,
  iconEnd,
  iconEndLabel,
  children,
}: {
  readonly size: ButtonSize;
  readonly iconStart: FixedIconName | undefined;
  readonly iconEnd: FixedIconName | undefined;
  readonly iconEndLabel?: string;
  readonly children: ReactNode;
}) => {
  const iconSize = size === "sm" || size === "md" ? "sm" : "md";

  return (
    <>
      {iconStart && <Icon name={iconStart} size={iconSize} />}
      {children}
      {iconEnd && (
        <Icon
          name={iconEnd}
          size={iconSize}
          {...(iconEndLabel === undefined ? {} : { label: iconEndLabel })}
        />
      )}
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
    // A loading button is disabled too, but busy: it keeps its full look.
    opacity: { default: 1, ":disabled:not([aria-busy])": opacity.disabled },
    textAlign: "center",
    transform: {
      default: "none",
      ":active:not(:disabled)": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty:
      "background-color, border-color, color, opacity, transform",
    transitionTimingFunction: motion.easing,
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  // Half of the row past an 8px gap, floored at the label's width: a label
  // wider than half breaks the line, and each then grows to fill its own.
  share: {
    flexBasis: `calc(50% - ${space[8]} / 2)`,
    flexGrow: 1,
    minWidth: "max-content",
  },
});

// A disabled button keeps its variant's look at the disabled opacity, so a
// disabled primary still reads as the primary action.
const buttonVariantStyles = stylex.create({
  primary: {
    backgroundColor: {
      default: color.accent,
      ":hover:not(:disabled)": color.accentHover,
    },
    color: color.onAccent,
  },
  secondary: {
    borderColor: color.borderStrong,
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: color.text,
  },
  ghost: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: color.text,
  },
  // The accent text on its soft tint; hover moves the tint toward the hover
  // surface, as a toned card's does.
  soft: {
    backgroundColor: {
      default: color.accentSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.accentSoft}, ${color.surfaceHover})`,
    },
    color: color.accentText,
  },
  // Status colors stay text on their soft tint; hover outlines the button.
  danger: {
    borderColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.danger,
    },
    backgroundColor: color.dangerSoft,
    color: color.danger,
  },
  // The danger color on a secondary button's surface; hover tints it softly.
  dangerOutline: {
    borderColor: color.danger,
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.dangerSoft,
    },
    color: color.danger,
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
