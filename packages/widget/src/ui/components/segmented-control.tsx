import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import * as stylex from "@stylexjs/stylex";

import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
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
import { hitAreaStyles } from "./hit-area";

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
 * pressed. One segment is always chosen. Under a coarse pointer each
 * segment's hit area grows to a finger's without changing how it looks.
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
        {...stylex.props(
          styles.segment,
          hitAreaStyles.coarse,
          option.value === value && styles.chosen,
          focusRingStyles.visible
        )}
      >
        {option.label}
      </Toggle>
    ))}
  </ToggleGroup>
);

// It marks its choice the way the tabs do: under the `pill` tabs indicator, a
// raised segment in a filled track; under `underline`, an accent line under
// the chosen label on a bare track. Each underline value sits under the
// ancestor condition inline: StyleX compiles `stylex.when` only where a style
// map uses it.
const styles = stylex.create({
  group: {
    padding: {
      default: space[2],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: 0,
    },
    borderRadius: {
      default: radius.control,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: 0,
    },
    gap: {
      default: space[2],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: space[12],
    },
    backgroundColor: {
      default: color.surface,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: "transparent",
    },
    boxSizing: "border-box",
    display: "inline-flex",
    height: controlHeight.sm,
  },
  segment: {
    margin: 0,
    borderRadius: {
      default: radius.controlInner,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: 0,
    },
    borderStyle: "none",
    paddingBlock: 0,
    paddingInline: {
      default: space[12],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: space[4],
    },
    backgroundColor: "transparent",
    boxShadow: "none",
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
  // The chosen segment: raised in the pill track, underlined on a bare one.
  chosen: {
    backgroundPosition: "bottom",
    backgroundColor: {
      default: color.surfaceRaised,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: "transparent",
    },
    // A thick accent line along the bottom, painted as a background so the
    // segment's size holds.
    backgroundImage: {
      default: null,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: `linear-gradient(${color.accent}, ${color.accent})`,
    },
    backgroundRepeat: "no-repeat",
    backgroundSize: `100% ${borderWidth.thick}`,
    boxShadow: {
      default: elevation.raised,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: "none",
    },
  },
});
