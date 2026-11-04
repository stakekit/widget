import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { useCopy } from "./use-copy";

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
 */
export const DetailRow = ({
  label,
  value,
  copyable,
}: {
  readonly label: string;
  /** The formatted value, or a part such as a `Badge` or `ExpandableAmount`. */
  readonly value: ReactNode;
  readonly copyable?: Copyable;
}) => (
  <div {...stylex.props(styles.row)}>
    <dt {...stylex.props(styles.term)}>
      <Text tone="muted">{label}</Text>
    </dt>
    <dd {...stylex.props(styles.description)}>
      <Text numeric truncate>
        {value}
      </Text>
      {copyable && <CopyControl {...copyable} />}
    </dd>
  </div>
);

const CopyControl = ({ value, label, copiedLabel }: Copyable) => {
  const { copied, copy, announcement } = useCopy();

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => copy(value)}
        {...stylex.props(styles.copy)}
      >
        <Icon name={copied ? "CheckIcon" : "CopyIcon"} size="sm" />
      </button>
      <VisuallyHidden role="status">{announcement(copiedLabel)}</VisuallyHidden>
    </>
  );
};

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
  copy: {
    margin: 0,
    padding: space[4],
    borderRadius: radius.badge,
    borderStyle: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": color.surfaceHover,
    },
    color: color.textMuted,
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    transform: { default: "none", ":active": motion.press },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, transform",
    transitionTimingFunction: motion.easing,
  },
});
