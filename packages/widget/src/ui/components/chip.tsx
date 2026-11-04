import * as stylex from "@stylexjs/stylex";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

/**
 * A small pill button for a quick action beside a field, such as "Max". With
 * `selected` it toggles and reads as pressed.
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
  readonly testId?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    data-testid={testId}
    {...stylex.props(styles.root, selected && styles.selected)}
  >
    {children}
  </button>
);

const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    paddingBlock: space[2],
    paddingInline: space[12],
    backgroundColor: {
      default: color.accentSoft,
      ":disabled": color.surface,
    },
    color: { default: color.accentText, ":disabled": color.textMuted },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.label,
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
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
  // The ring marks the chosen chip besides its pressed state.
  selected: {
    borderColor: { default: color.accent, ":disabled": color.border },
  },
});
