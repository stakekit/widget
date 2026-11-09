import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { HostHook } from "../host-hook";
import { Text } from "../primitives/text";
import { space } from "../tokens/space.stylex";
import { Avatar } from "./avatar";
import { CopyButton } from "./copy-button";
import { InfoTip } from "./info-tip";
import { Meter } from "./meter";
import { Skeleton } from "./skeleton";

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

// A meter takes the row's tone; an untoned or muted row's meter is accent.
const meterTone = {
  default: "accent",
  muted: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

/** Label-value rows, such as a position's or a transaction's details. */
export const DetailList = ({ children }: { readonly children: ReactNode }) => (
  <dl {...stylex.props(styles.list)}>{children}</dl>
);

/**
 * The value's text tone, such as `danger` for a value at risk, `success` for
 * an amount the user can claim or `muted` for an estimate.
 */
type DetailRowTone = "default" | "muted" | "success" | "warning" | "danger";

/** An info button beside the label that explains the figure. */
type DetailRowInfo = {
  /** Names the info button, such as "About the deposit fee". */
  readonly label: string;
  readonly text: string;
};

type Copyable = {
  /** What is copied, in full, whatever the row shows. */
  readonly value: string;
  /** Names the copy button, such as "Copy address". */
  readonly label: string;
  /** Announced once copied, such as "Copied". */
  readonly copiedLabel: string;
};

/**
 * The logo of what the value names, such as a network's, a token's or a
 * provider's; it is decorative, as the value names it.
 */
export type DetailRowLogo = {
  /** The logo's URL; unset or failing, the name's initials show. */
  readonly src?: string | undefined;
  readonly name: string;
  /** `square` for a validator's logo. */
  readonly shape?: "round" | "square";
};

/**
 * One row of a `DetailList`: the label, and the value at the end. With
 * `copyable` a button beside the value copies it and announces the outcome.
 * A `caption` under the value gives its context, such as its fiat value.
 * An `info` button beside the label explains the figure. A `logo` before
 * the value shows what it names, such as a network. A `meter` draws the
 * value as a thin gauge across the row's width, under it, in the row's
 * tone.
 */
export const DetailRow = ({
  label,
  value,
  caption,
  copyable,
  logo,
  info,
  tone = "default",
  meter,
  testId,
  hostHook,
}: {
  readonly label: string;
  /** The formatted value, or a part such as a `Badge` or `ExpandableAmount`. */
  readonly value: ReactNode;
  readonly copyable?: Copyable;
  readonly logo?: DetailRowLogo | undefined;
  /** Context under the value, such as its fiat equivalent. */
  readonly caption?: string | undefined;
  readonly info?: DetailRowInfo | undefined;
  readonly tone?: DetailRowTone | undefined;
  readonly meter?: DetailRowMeter | undefined;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string | undefined;
  /** Renders as the row's `data-rk`, for hosts to locate it. */
  readonly hostHook?: HostHook | undefined;
}) => (
  <div
    data-testid={testId}
    data-rk={hostHook}
    {...stylex.props(styles.row, meter !== undefined && styles.meterRow)}
  >
    <dt {...stylex.props(styles.term)}>
      <Text tone="muted">{label}</Text>
      {info && <InfoTip label={info.label}>{info.text}</InfoTip>}
    </dt>
    <dd {...stylex.props(styles.description)}>
      {logo && (
        <Avatar
          src={logo.src}
          fallback={logo.name}
          size="xs"
          shape={logo.shape ?? "round"}
        />
      )}
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

/**
 * One row of `DetailRows`, as data: what a `DetailRow` shows, with a
 * formatted value or one still loading.
 */
export type DetailItem = {
  readonly label: string;
  /** Context under the value, such as its fiat value or what it counts. */
  readonly caption?: string | undefined;
  readonly info?: DetailRowInfo | undefined;
  /** The logo of what the value names, such as a network's. */
  readonly logo?: DetailRowLogo | undefined;
  readonly tone?: DetailRowTone | undefined;
  /** The value as a thin gauge under the row, such as the LTV it leaves. */
  readonly meter?: DetailRowMeter | undefined;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string | undefined;
  /** Renders as the row's `data-rk`, for hosts to locate it. */
  readonly hostHook?: HostHook | undefined;
} & (
  | {
      /** The formatted value, such as "$1.20" or "0.5%". */
      readonly value: string;
      readonly loading?: never;
    }
  | {
      /**
       * The value is still loading, such as a gas estimate: a placeholder
       * holds its place while the other rows show.
       */
      readonly loading: true;
      readonly value?: never;
    }
);

/**
 * A `DetailList` of `DetailRow`s drawn from `rows`, one per label; a value
 * still loading shows a placeholder a short figure wide. The patterns'
 * label-value rows; Features compose `DetailRow`s themselves.
 */
export const DetailRows = ({
  rows,
}: {
  readonly rows: ReadonlyArray<DetailItem>;
}) => (
  <DetailList>
    {rows.map(({ loading, value, ...row }) => (
      <DetailRow
        key={row.label}
        {...row}
        value={
          loading === true ? (
            <span {...stylex.props(styles.pendingValue)}>
              <Skeleton shape="line" />
            </span>
          ) : (
            value
          )
        }
      />
    ))}
  </DetailList>
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
  term: {
    margin: 0,
    gap: space[4],
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
  },
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
  // The value's width is unknown while it loads; a short figure's stands in.
  pendingValue: { display: "block", width: space[64] },
});
