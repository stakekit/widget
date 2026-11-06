import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import * as stylex from "@stylexjs/stylex";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";
import type { ToggleOption } from "./segmented-control";

/** One chip: a choice, and how many items it matches, formatted. */
type ChipOption<T extends string> = ToggleOption<T> & {
  readonly count?: string;
};

type ChipGroupProps<T extends string> = {
  readonly options: ReadonlyArray<ChipOption<T>>;
  /** The chosen chips; empty chooses none. */
  readonly value: ReadonlyArray<NoInfer<T>>;
  readonly onValueChange: (value: ReadonlyArray<T>) => void;
  /** Names the group. */
  readonly label: string;
  readonly disabled?: boolean;
};

/**
 * Filters as chips: any number of them can be on, such as the Activity
 * filters. Arrow keys move between chips and Enter or Space toggles one; an
 * on chip is pressed. A chip's `count` follows its label in tabular figures.
 */
export const ChipGroup = <const T extends string>({
  options,
  value,
  onValueChange,
  label,
  disabled = false,
}: ChipGroupProps<T>) => (
  <ToggleGroup<T>
    aria-label={label}
    multiple
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
    {...stylex.props(styles.group)}
  >
    {options.map((option) => (
      <Toggle<T>
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        {...stylex.props(styles.chip, focusRingStyles.visible)}
      >
        {option.label}
        {option.count !== undefined && (
          <span {...stylex.props(styles.count)}>{option.count}</span>
        )}
      </Toggle>
    ))}
  </ToggleGroup>
);

const styles = stylex.create({
  group: {
    gap: space[8],
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 0,
    borderColor: {
      default: color.borderStrong,
      ":is([data-pressed])": color.accent,
    },
    borderRadius: radius.pillControl,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[6],
    paddingBlock: space[4],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: {
      default: color.surface,
      ":hover:not([data-disabled], [data-pressed])": color.surfaceHover,
      ":is([data-pressed])": color.accentSoft,
    },
    color: {
      default: color.text,
      ":is([data-pressed])": color.accentText,
    },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
    opacity: { default: 1, ":is([data-disabled])": opacity.disabled },
    transform: {
      default: "none",
      ":active:not([data-disabled])": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty:
      "background-color, border-color, color, opacity, transform",
    transitionTimingFunction: motion.easing,
    whiteSpace: "nowrap",
  },
  count: { fontVariantNumeric: "tabular-nums" },
});
