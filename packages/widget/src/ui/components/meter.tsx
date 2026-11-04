import { Meter as BaseMeter } from "@base-ui/react/meter";
import * as stylex from "@stylexjs/stylex";
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

type MeterProps = {
  /** Names the measure, such as "Loan to value". */
  readonly label: string;
  /** Where the measure stands, from `min` to `max`. */
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  /** The value as the user reads it, formatted, such as "62%". */
  readonly valueText: string;
  /** Meaning through color, such as `warning` near a liquidation threshold. */
  readonly tone?: keyof typeof toneStyles;
};

/**
 * A gauge of a measure within a known range, such as loan to value. It is a
 * `meter` named by its label, and reads out `valueText`.
 */
export const Meter = ({
  label,
  value,
  min = 0,
  max = 100,
  valueText,
  tone = "accent",
}: MeterProps) => (
  <BaseMeter.Root
    value={value}
    min={min}
    max={max}
    getAriaValueText={() => valueText}
    {...stylex.props(styles.root)}
  >
    <div {...stylex.props(styles.header)}>
      <BaseMeter.Label {...stylex.props(styles.label)}>{label}</BaseMeter.Label>
      <span {...stylex.props(styles.value)}>{valueText}</span>
    </div>
    <BaseMeter.Track {...stylex.props(styles.track)}>
      <BaseMeter.Indicator
        {...stylex.props(styles.indicator, toneStyles[tone])}
      />
    </BaseMeter.Track>
  </BaseMeter.Root>
);

const styles = stylex.create({
  root: {
    gap: space[6],
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
  },
  header: {
    gap: space[8],
    display: "flex",
    justifyContent: "space-between",
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
  },
  value: {
    color: color.text,
    fontSize: fontSize.label,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.label,
  },
  track: {
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: color.surface,
    height: space[8],
  },
  indicator: {
    borderRadius: radius.pill,
    display: "block",
    transitionDuration: motion.base,
    transitionProperty: "width",
    transitionTimingFunction: motion.easing,
    height: "100%",
  },
});

// Each tone fills with its text role, the strongest of its hue.
const toneStyles = stylex.create({
  accent: { backgroundColor: color.accentText },
  success: { backgroundColor: color.success },
  warning: { backgroundColor: color.warning },
  danger: { backgroundColor: color.danger },
});
