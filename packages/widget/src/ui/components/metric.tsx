import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, use } from "react";
import {
  columnsStyles,
  gapStyles,
  layoutStyles,
  type Responsive,
  type Space,
} from "../primitives/layout";
import { Text } from "../primitives/text";
import { space } from "../tokens/space.stylex";

const InMetricGroup = createContext(false);

/**
 * A labelled figure: the label above a neutral value, with an optional
 * caption. Inside a `MetricGroup` it is a term and its description.
 */
export const Metric = ({
  label,
  value,
  caption,
  valueTone = "default",
}: {
  readonly label: string;
  /** The formatted figure, or an `ExpandableAmount`. */
  readonly value: ReactNode;
  /** Context under the value, such as its fiat equivalent. */
  readonly caption?: ReactNode;
  /**
   * `success` is for positive rates and claimable amounts only; `warning`
   * and `danger` mark a risk figure, such as a health factor near liquidation.
   */
  readonly valueTone?: "default" | "success" | "warning" | "danger";
}) => {
  const grouped = use(InMetricGroup);
  const [Term, Description] = grouped
    ? (["dt", "dd"] as const)
    : (["div", "div"] as const);

  return (
    <div {...stylex.props(styles.root)}>
      <Term {...stylex.props(styles.part)}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
      </Term>
      <Description {...stylex.props(styles.part, styles.value)}>
        <Text variant="metric" tone={valueTone}>
          {value}
        </Text>
        {caption !== undefined && (
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
        )}
      </Description>
    </div>
  );
};

/**
 * Metrics side by side: as many columns as fit (`metrics`), or a fixed count.
 * Screen readers read each metric as a term and its description.
 */
export const MetricGroup = ({
  columns = "metrics",
  gap = 16,
  children,
}: {
  readonly columns?: Responsive<1 | 2 | 3 | 4 | "metrics">;
  readonly gap?: Responsive<Space>;
  readonly children: ReactNode;
}) => (
  <InMetricGroup value>
    <dl
      {...stylex.props(
        styles.group,
        layoutStyles.columns,
        layoutStyles.gap,
        columnsStyles(columns),
        gapStyles(gap)
      )}
    >
      {children}
    </dl>
  </InMetricGroup>
);

const styles = stylex.create({
  root: {
    gap: space[4],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  part: { margin: 0 },
  value: { display: "flex", flexDirection: "column" },
  group: { margin: 0, display: "grid" },
});
