import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
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
import { focusRingStyles } from "./focus-ring";

/** One choice in a `SegmentedControl` or `ChipGroup`. */
export type ToggleOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  readonly options: ReadonlyArray<ToggleOption<T>>;
  readonly value: NoInfer<T>;
  readonly onValueChange: (value: T) => void;
  /** Names the group. */
  readonly label: string;
  readonly disabled?: boolean;
};

/**
 * One choice out of a few, side by side, such as a chart period. Arrow keys
 * move between segments and Enter or Space chooses one; the chosen segment is
 * pressed. One segment is always chosen.
 */
export const SegmentedControl = <const T extends string>({
  options,
  value,
  onValueChange,
  label,
  disabled = false,
}: SegmentedControlProps<T>) => (
  <ToggleGroup<T>
    aria-label={label}
    value={[value]}
    onValueChange={(next) => {
      const [chosen] = next;
      if (chosen !== undefined) onValueChange(chosen);
    }}
    disabled={disabled}
    {...stylex.props(styles.group)}
  >
    {options.map((option) => (
      <Toggle<T>
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        {...stylex.props(styles.segment, focusRingStyles.visible)}
      >
        {option.label}
      </Toggle>
    ))}
  </ToggleGroup>
);

const styles = stylex.create({
  group: {
    padding: space[2],
    borderRadius: radius.control,
    gap: space[2],
    backgroundColor: color.surface,
    boxSizing: "border-box",
    display: "inline-flex",
    height: controlHeight.sm,
  },
  segment: {
    margin: 0,
    borderRadius: radius.controlInner,
    borderStyle: "none",
    paddingBlock: 0,
    paddingInline: space[12],
    backgroundColor: {
      default: "transparent",
      ":is([data-pressed])": color.surfaceRaised,
    },
    boxShadow: { default: "none", ":is([data-pressed])": elevation.raised },
    color: {
      default: color.textMuted,
      ":hover:not([data-disabled])": color.text,
      ":is([data-pressed])": color.text,
    },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    flexBasis: 0,
    flexGrow: 1,
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
    opacity: { default: 1, ":is([data-disabled])": opacity.disabled },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, box-shadow, color, opacity",
    transitionTimingFunction: motion.easing,
    whiteSpace: "nowrap",
  },
});
