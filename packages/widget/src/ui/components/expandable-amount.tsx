import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { hitAreaStyles } from "./hit-area";

/**
 * An amount shown short ("1.23K") that a tap or Enter expands to the full
 * figure and back. It takes the surrounding type role, so it sits inside a
 * `Text`, `Metric` or `DetailRow` value; under a coarse pointer its hit area
 * grows to a finger's without changing how it reads.
 */
export const ExpandableAmount = ({
  short,
  full,
  defaultExpanded = false,
}: {
  readonly short: string;
  readonly full: string;
  readonly defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      {...stylex.props(styles.root, hitAreaStyles.coarse)}
    >
      {expanded ? full : short}
    </button>
  );
};

const styles = stylex.create({
  root: {
    margin: 0,
    padding: 0,
    borderRadius: radius.badge,
    borderStyle: "none",
    backgroundColor: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    lineHeight: "inherit",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    textAlign: "inherit",
  },
});
