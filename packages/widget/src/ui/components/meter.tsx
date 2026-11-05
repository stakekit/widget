import { Meter as BaseMeter } from "@base-ui/react/meter";
import * as stylex from "@stylexjs/stylex";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
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
  /**
   * A point on the scale drawn as a tick across the track, such as the
   * liquidation threshold. Its label reads out with the value.
   */
  readonly marker?: {
    readonly value: number;
    /** Names the point, such as "Liquidation at 86%". */
    readonly label: string;
  };
  /** Captions under the track's two ends, such as "Low risk". */
  readonly scale?: {
    readonly start?: string;
    readonly end?: string;
  };
  /**
   * `compact` draws only a thin track, for under a row that already shows
   * the label and value, such as "LTV ratio" in a details list; the label and
   * value still read out, and `scale` is not drawn.
   */
  readonly size?: "regular" | "compact";
};

const percentOf = (value: number, min: number, max: number) =>
  max === min
    ? 0
    : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

/**
 * A gauge of a measure within a known range, such as loan to value. It is a
 * `meter` named by its label, and reads out `valueText`. The tone colors the
 * fill and the value alike, so a risk reads the same in both.
 */
export const Meter = ({
  label,
  value,
  min = 0,
  max = 100,
  valueText,
  tone = "accent",
  marker,
  scale,
  size = "regular",
}: MeterProps) => (
  <BaseMeter.Root
    value={value}
    min={min}
    max={max}
    getAriaValueText={() =>
      marker === undefined ? valueText : `${valueText}, ${marker.label}`
    }
    {...stylex.props(styles.root)}
  >
    {size === "compact" ? (
      <VisuallyHidden>
        <BaseMeter.Label>{label}</BaseMeter.Label>
      </VisuallyHidden>
    ) : (
      <div {...stylex.props(styles.header)}>
        <BaseMeter.Label {...stylex.props(styles.label)}>
          {label}
        </BaseMeter.Label>
        <span {...stylex.props(styles.value, valueToneStyles[tone])}>
          {valueText}
        </span>
      </div>
    )}
    <div {...stylex.props(styles.trackFrame)}>
      <BaseMeter.Track
        {...stylex.props(styles.track, size === "compact" && styles.thinTrack)}
      >
        <BaseMeter.Indicator
          {...stylex.props(styles.indicator, toneStyles[tone])}
        />
      </BaseMeter.Track>
      {marker !== undefined && (
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.marker,
            styles.markerPosition(`${percentOf(marker.value, min, max)}%`)
          )}
        />
      )}
    </div>
    {scale !== undefined && size === "regular" && (
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.scale)}>{scale.start}</span>
        <span {...stylex.props(styles.scale)}>{scale.end}</span>
      </div>
    )}
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
  trackFrame: { position: "relative" },
  // The border role reads on the page and on a card surface alike.
  track: {
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: color.borderStrong,
    height: space[8],
  },
  thinTrack: { height: space[4] },
  indicator: {
    borderRadius: radius.pill,
    display: "block",
    transitionDuration: motion.base,
    transitionProperty: "width",
    transitionTimingFunction: motion.easing,
    height: "100%",
  },
  // A tick across the track, taller than it so it reads over the fill.
  marker: {
    borderRadius: radius.pill,
    insetBlock: `calc(-1 * ${space[2]})`,
    backgroundColor: color.text,
    position: "absolute",
    transform: "translateX(-50%)",
    width: borderWidth.thick,
  },
  markerPosition: (inset: string) => ({ insetInlineStart: inset }),
  scale: {
    color: color.textMuted,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
  },
});

// Each tone fills with its text role, the strongest of its hue.
const toneStyles = stylex.create({
  accent: { backgroundColor: color.accentText },
  success: { backgroundColor: color.success },
  warning: { backgroundColor: color.warning },
  danger: { backgroundColor: color.danger },
});

// The value reads in its tone's text role; an accent meter's value stays text.
const valueToneStyles = stylex.create({
  accent: { color: color.text },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
});
