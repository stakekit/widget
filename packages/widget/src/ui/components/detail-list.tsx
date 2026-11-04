import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Text } from "../primitives/text";
import { space } from "../tokens/space.stylex";
import { CopyButton } from "./copy-button";

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
 */
export const DetailRow = ({
  label,
  value,
  caption,
  copyable,
  tone = "default",
  testId,
}: {
  readonly label: string;
  /** The formatted value, or a part such as a `Badge` or `ExpandableAmount`. */
  readonly value: ReactNode;
  readonly copyable?: Copyable;
  /** Context under the value, such as its fiat equivalent. */
  readonly caption?: string;
  /** The value's text tone, such as `danger` for a value at risk. */
  readonly tone?: "default" | "warning" | "danger";
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
}) => (
  <div data-testid={testId} {...stylex.props(styles.row)}>
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
