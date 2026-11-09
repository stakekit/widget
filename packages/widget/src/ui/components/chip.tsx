import * as stylex from "@stylexjs/stylex";

import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color, softControlTint } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { hitAreaStyles } from "./hit-area";

/**
 * A small pill button for a quick action beside a field, such as "Max". With
 * `selected` it toggles and reads as pressed. It is as tall as a small
 * control, and a coarse pointer can tap it from a little around it.
 */
export const Chip = ({
  onClick,
  disabled = false,
  selected,
  children,
  testId,
}: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly children: string;
  /** Renders as the chip's `data-testid`. */
  readonly testId?: string | undefined;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    data-testid={testId}
    {...stylex.props(
      styles.root,
      hitAreaStyles.coarse,
      selected && styles.selected
    )}
  >
    {children}
  </button>
);

const styles = stylex.create({
  root: {
    margin: 0,
    // Its tint nearly matches the card it sits on: a 1px edge of the label
    // mixed into `surface` bounds it (`softControlTint`).
    borderColor: `color-mix(in srgb, currentColor ${softControlTint.edge}, ${color.surface})`,
    borderRadius: radius.pillControl,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    paddingBlock: space[2],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: color.accentSoft,
    boxSizing: "border-box",
    color: color.accentText,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    justifyContent: "center",
    lineHeight: lineHeight.label,
    opacity: { default: 1, ":disabled": opacity.disabled },
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
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
    minHeight: controlHeight.sm,
  },
  // The ring marks the chosen chip besides its pressed state.
  selected: { borderColor: color.accent },
});
