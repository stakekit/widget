import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, Ref } from "react";

import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { controlRadius, radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { focusRingStyles } from "./focus-ring";
import { hitAreaStyles } from "./hit-area";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "children" | "aria-label" | "type"
> & {
  readonly ref?: Ref<HTMLButtonElement>;
  readonly icon: FixedIconName;
  /** The button's accessible name; it has no visible text. */
  readonly label: string;
  readonly variant?: keyof typeof variantStyles;
  /** `xs` sits inline in a row of text; `sm` and `md` match control heights. */
  readonly size?: keyof typeof sizeStyles;
  /** Rendered as `data-testid`. */
  readonly testId?: string;
};

/**
 * A button that shows only an icon, such as back, close or info. It must be
 * named with `label`. It forwards its ref and props, so it can open a
 * `Tooltip`, `Popover` or `Menu`. Its corners follow its size, and under a
 * coarse pointer its hit area reaches a touch target's size whatever its
 * drawn size.
 */
export const IconButton = ({
  icon,
  label,
  variant = "ghost",
  size = "sm",
  disabled = false,
  testId,
  ...rest
}: IconButtonProps) => (
  <button
    {...rest}
    type="button"
    aria-label={label}
    disabled={disabled}
    {...(testId === undefined ? {} : { "data-testid": testId })}
    {...stylex.props(
      styles.root,
      hitAreaStyles.coarse,
      focusRingStyles.visible,
      variantStyles[variant],
      sizeStyles[size]
    )}
  >
    <Icon name={icon} size={size === "md" ? "md" : "sm"} />
  </button>
);

const styles = stylex.create({
  root: {
    margin: 0,
    padding: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    alignItems: "center",
    boxSizing: "border-box",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    transform: { default: "none", ":active:not(:disabled)": motion.press },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color, color, transform",
    transitionTimingFunction: motion.easing,
  },
});

const variantStyles = stylex.create({
  ghost: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: {
      default: color.textMuted,
      ":hover:not(:disabled)": color.text,
      ":disabled": color.textSubtle,
    },
  },
  secondary: {
    borderColor: { default: color.borderStrong, ":disabled": color.border },
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: { default: color.text, ":disabled": color.textMuted },
  },
});

const sizeStyles = stylex.create({
  xs: { padding: space[4], borderRadius: radius.badge, borderWidth: 0 },
  sm: {
    borderRadius: controlRadius.sm,
    height: controlHeight.sm,
    width: controlHeight.sm,
  },
  md: {
    borderRadius: controlRadius.md,
    height: controlHeight.md,
    width: controlHeight.md,
  },
});
