import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color, pressTint, softControlTint } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { callToAction } from "../tokens/presentation.stylex";
import { controlRadius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";
import { hitAreaStyles } from "./hit-area";

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

/**
 * The class names of a button's look, for a `button` or an `a`. Its corners
 * follow its size, and under a coarse pointer its hit area reaches a touch
 * target's size whatever its drawn height.
 */
export const buttonLook = (
  variant: ButtonVariant,
  size: ButtonSize,
  share: boolean
) =>
  stylex.props(
    buttonStyles.root,
    hitAreaStyles.coarse,
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
      {iconEnd && <Icon name={iconEnd} size={iconSize} label={iconEndLabel} />}
    </>
  );
};

const buttonStyles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
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

// A disabled secondary, ghost or danger button keeps its variant's look at
// the disabled opacity. A disabled primary or soft button instead takes a
// neutral fill under a `textMuted` label, as its accent faded to 40% leaves
// the label unreadable on many accents, and the label often carries the
// reason it is disabled ("Enter an amount"). A filled button's fill also
// changes while pressed (`pressTint`), on top of the press scale, which
// reduced motion removes; its hover leaves off while pressed, as the two
// share a specificity and StyleX does not order them.
const disabledFill = ":disabled:not([aria-busy])";

const buttonVariantStyles = stylex.create({
  primary: {
    backgroundColor: {
      default: color.accent,
      [disabledFill]: color.surfaceHover,
      ":active:not(:disabled)": `color-mix(in srgb, ${color.accentHover}, ${pressTint.ink} ${pressTint.shade})`,
      ":hover:not(:disabled, :active)": color.accentHover,
    },
    color: { default: color.onAccent, [disabledFill]: color.textMuted },
    opacity: 1,
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
  // The accent text on its soft tint, bounded by a 1px edge of the text mixed
  // into `surface` (`softControlTint`), as the tint alone vanishes into a
  // filled card; hover moves the tint toward the hover surface, as a toned
  // card's does, and a press fills it toward the text.
  soft: {
    borderColor: `color-mix(in srgb, currentColor ${softControlTint.edge}, ${color.surface})`,
    backgroundColor: {
      default: color.accentSoft,
      [disabledFill]: color.surfaceHover,
      ":active:not(:disabled)": `color-mix(in srgb, currentColor ${pressTint.toneFill}, ${color.accentSoft})`,
      ":hover:not(:disabled, :active)": `color-mix(in srgb, ${color.accentSoft}, ${color.surfaceHover})`,
    },
    color: { default: color.accentText, [disabledFill]: color.textMuted },
    opacity: 1,
  },
  // Status colors stay text on their soft tint; hover outlines the button,
  // and a press fills the tint toward the text.
  danger: {
    borderColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.danger,
    },
    backgroundColor: {
      default: color.dangerSoft,
      ":active:not(:disabled)": `color-mix(in srgb, currentColor ${pressTint.toneFill}, ${color.dangerSoft})`,
    },
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
    borderRadius: controlRadius.sm,
    paddingInline: space[12],
    fontSize: fontSize.label,
    lineHeight: lineHeight.label,
    height: controlHeight.sm,
  },
  md: {
    borderRadius: controlRadius.md,
    paddingInline: space[16],
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    height: controlHeight.md,
  },
  lg: {
    borderRadius: controlRadius.lg,
    paddingInline: space[20],
    fontSize: fontSize.heading,
    lineHeight: lineHeight.heading,
    height: controlHeight.lg,
  },
  cta: {
    borderRadius: controlRadius.lg,
    paddingInline: space[24],
    fontSize: fontSize.heading,
    lineHeight: lineHeight.heading,
    height: callToAction.height,
    width: "100%",
  },
});
