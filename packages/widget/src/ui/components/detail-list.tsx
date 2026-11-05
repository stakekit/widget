import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { HostHook } from "../host-hook";
import { Text } from "../primitives/text";
import { space } from "../tokens/space.stylex";
import { CopyButton } from "./copy-button";
import { Meter } from "./meter";

/** The value as a gauge under the row, such as loan to value. */
export type DetailRowMeter = {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  /** The value as the user reads it, such as "62%". */
  readonly valueText: string;
  /** A point on the scale, such as max LTV; it reads out with the value. */
  readonly marker?: { readonly value: number; readonly label: string };
};

// A meter takes the row's tone; an untoned row's meter is accent.
const meterTone = {
  default: "accent",
  warning: "warning",
  danger: "danger",
} as const;

/** Label-value rows, such as a position's or a transaction's details. */
export const DetailList = ({ children }: { readonly children: ReactNode }) => (
  <dl {...stylex.props(styles.list)}>{children}</dl>
);

type Copyable = {
  /** What is copied, in full, whatever the row shows. */
  readonly value: string;
  /** Names the copy button, such as "Copy address". */
  readonly label: string;
  /** Announced once copied, such as "Copied". */
  readonly copiedLabel: string;
};

/**
 * One row of a `DetailList`: the label, and the value at the end. With
 * `copyable` a button beside the value copies it and announces the outcome.
 * A `caption` under the value gives its context, such as its fiat value.
 * A `meter` draws the value as a thin gauge across the row's width, under
 * it, in the row's tone.
 */
export const DetailRow = ({
  label,
  value,
  caption,
  copyable,
  tone = "default",
  meter,
  testId,
  hostHook,
}: {
  readonly label: string;
  /** The formatted value, or a part such as a `Badge` or `ExpandableAmount`. */
  readonly value: ReactNode;
  readonly copyable?: Copyable;
  /** Context under the value, such as its fiat equivalent. */
  readonly caption?: string;
  /** The value's text tone, such as `danger` for a value at risk. */
  readonly tone?: "default" | "warning" | "danger";
  readonly meter?: DetailRowMeter;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
  /** Renders as the row's `data-rk`, for hosts to locate it. */
  readonly hostHook?: HostHook;
}) => (
  <div
    data-testid={testId}
    data-rk={hostHook}
    {...stylex.props(styles.row, meter !== undefined && styles.meterRow)}
  >
    <dt {...stylex.props(styles.term)}>
      <Text tone="muted">{label}</Text>
    </dt>
    <dd {...stylex.props(styles.description)}>
      {caption === undefined ? (
        <Text numeric truncate tone={tone}>
          {value}
        </Text>
      ) : (
        <span {...stylex.props(styles.values)}>
          <Text numeric truncate tone={tone}>
            {value}
          </Text>
          <Text variant="caption" tone="muted" numeric>
            {caption}
          </Text>
        </span>
      )}
      {copyable && <CopyButton {...copyable} />}
    </dd>
    {/* A second description of the same term: the value as a gauge. */}
    {meter !== undefined && (
      <dd {...stylex.props(styles.meter)}>
        <Meter label={label} size="compact" tone={meterTone[tone]} {...meter} />
      </dd>
    )}
  </div>
);

const styles = stylex.create({
  list: {
    margin: 0,
    gap: space[12],
    display: "flex",
    flexDirection: "column",
  },
  row: {
    gap: space[16],
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    minWidth: 0,
  },
  // The gauge spans the row under the label and value.
  meterRow: {
    columnGap: space[16],
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    rowGap: space[6],
  },
  meter: { margin: 0, gridColumnEnd: "-1", gridColumnStart: "1" },
  term: { margin: 0, flexShrink: 0 },
  description: {
    margin: 0,
    gap: space[4],
    alignItems: "center",
    display: "flex",
    justifyContent: "flex-end",
    textAlign: "end",
    minWidth: 0,
  },
  values: {
    alignItems: "flex-end",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
});
