import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Badge } from "../components/badge";
import { Card } from "../components/card";
import { type DetailItem, DetailRows } from "../components/detail-list";
import { Divider } from "../components/divider";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { container } from "../tokens/container.stylex";
import { space } from "../tokens/space.stylex";

type PositionSummaryMetric = {
  readonly label: string;
  /** The formatted figure, such as "$2,100.00" or "1.42". */
  readonly value: string;
  /**
   * `warning` and `danger` mark a risk figure, such as a health factor near
   * liquidation.
   */
  readonly tone?: "default" | "success" | "muted" | "warning" | "danger";
};

type PositionSummaryProps = {
  /** What the card sums up, such as "Your position". */
  readonly label: string;
  /** The hero figure, already formatted, such as "$0.23". */
  readonly value: string;
  /** The figure under the hero, such as the token amount "0.2331 USDC". */
  readonly subvalue?: string | undefined;
  /**
   * A property of the whole position beside the hero, such as its reward
   * rate "4.06% APY", in `success`.
   */
  readonly badge?: string | undefined;
  /** Side figures beside the hero, such as a borrow position's debt. */
  readonly metrics?: ReadonlyArray<PositionSummaryMetric>;
  /**
   * Label-value rows under a divider, such as what the position earned and
   * is projected to earn.
   */
  readonly rows?: ReadonlyArray<DetailItem>;
  /** Extra content under the figures, such as an LTV `Meter`. */
  readonly children?: ReactNode;
  /** A placeholder in the same shape while the position loads. */
  readonly loading?: boolean;
  /** Renders as the card's `data-testid`. */
  readonly testId?: string | undefined;
};

/**
 * The block a position's page leads with: what the position is worth as the
 * hero figure, its token amount under it, an optional badge beside it, a few
 * side figures, and label-value rows under a divider. From `sm` the hero
 * sits left and the side figures right on one row; narrower they stack.
 * Screen readers read each figure as a term and its description.
 */
export const PositionSummary = ({
  label,
  value,
  subvalue,
  badge,
  metrics = [],
  rows = [],
  children,
  loading = false,
  testId,
}: PositionSummaryProps) => (
  <Card padding={16} testId={testId}>
    <Stack gap={16} {...(loading ? { "aria-busy": true } : {})}>
      <div {...stylex.props(styles.top)}>
        <dl {...stylex.props(styles.figures)}>
          <div {...stylex.props(styles.hero)}>
            <dt {...stylex.props(styles.part)}>
              <Text variant="label" tone="muted">
                {label}
              </Text>
            </dt>
            <dd {...stylex.props(styles.part, styles.column)}>
              {loading ? (
                <>
                  <Skeleton shape="line" variant="title" width="half" />
                  <Skeleton shape="line" variant="caption" width="quarter" />
                </>
              ) : (
                <>
                  <Text variant="title" as="span" numeric breakAnywhere>
                    {value}
                  </Text>
                  {subvalue !== undefined && (
                    <Text variant="caption" tone="muted" numeric breakAnywhere>
                      {subvalue}
                    </Text>
                  )}
                </>
              )}
            </dd>
          </div>
          {metrics.map((metric) => (
            <div key={metric.label} {...stylex.props(styles.metric)}>
              <dt {...stylex.props(styles.part)}>
                <Text variant="label" tone="muted">
                  {metric.label}
                </Text>
              </dt>
              <dd {...stylex.props(styles.part)}>
                {loading ? (
                  <Skeleton shape="line" variant="metric" width="full" />
                ) : (
                  <Text
                    variant="metric"
                    as="span"
                    numeric
                    tone={metric.tone ?? "default"}
                  >
                    {metric.value}
                  </Text>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {badge !== undefined && !loading && (
          <Badge tone="success" variant="outline">
            {badge}
          </Badge>
        )}
      </div>
      {rows.length > 0 && !loading && (
        <>
          <Divider />
          <DetailRows rows={rows} />
        </>
      )}
      {children}
    </Stack>
  </Card>
);

// Each figure is a direct group of the list, so screen readers pair its
// term and description. Below `sm` the hero takes its own line and the
// side figures wrap under it; from `sm` they share the row, the hero
// growing so the figures sit right. A badge sits at the top's end.
const styles = stylex.create({
  top: {
    gap: space[12],
    alignItems: "flex-start",
    display: "flex",
    minWidth: 0,
  },
  figures: {
    margin: 0,
    gap: space[16],
    alignItems: "flex-start",
    display: "flex",
    flexGrow: 1,
    flexWrap: "wrap",
    minWidth: 0,
  },
  hero: {
    gap: space[4],
    display: "flex",
    flexBasis: { default: "100%", [container.sm]: 0 },
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  column: { display: "flex", flexDirection: "column" },
  metric: {
    gap: space[4],
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    textAlign: { default: "start", [container.sm]: "end" },
    minWidth: space[64],
  },
  part: { margin: 0 },
});
