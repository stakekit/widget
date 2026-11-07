import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { Card } from "../components/card";
import { InfoTip } from "../components/info-tip";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { container } from "../tokens/container.stylex";
import { space } from "../tokens/space.stylex";

type PositionSummaryMetric = {
  readonly label: string;
  /** The formatted figure, such as "4.12%" or "+$1.20 / yr". */
  readonly value: string;
  /**
   * `success` for a positive rate or earnings; `warning` and `danger` mark a
   * risk figure, such as a health factor near liquidation.
   */
  readonly tone?: "default" | "success" | "muted" | "warning" | "danger";
  /** A muted line under the figure, such as "0.52 POL total". */
  readonly caption?: string;
  /** An info button beside the label that explains the figure. */
  readonly info?: { readonly label: string; readonly text: string };
};

type PositionSummaryProps = {
  /** What the card sums up, such as "Your position". */
  readonly label: string;
  /** The hero figure, already formatted, such as "$0.23". */
  readonly value: string;
  /** The figure under the hero, such as the token amount "0.2331 USDC". */
  readonly subvalue?: string;
  /** The side figures, such as the APY and the estimated yearly earnings. */
  readonly metrics: ReadonlyArray<PositionSummaryMetric>;
  /** Extra content under the figures, such as an LTV `Meter`. */
  readonly children?: ReactNode;
  /** A placeholder in the same shape while the position loads. */
  readonly loading?: boolean;
  /** Renders as the card's `data-testid`. */
  readonly testId?: string;
};

/**
 * The block a position's page leads with: what the position is worth as the
 * hero figure, its token amount under it, and a few side figures. From `sm`
 * the hero sits left and the figures right on one row; narrower they stack.
 * Screen readers read each figure as a term and its description.
 */
export const PositionSummary = ({
  label,
  value,
  subvalue,
  metrics,
  children,
  loading = false,
  testId,
}: PositionSummaryProps) => (
  <Card padding={16} {...(testId === undefined ? {} : { testId })}>
    <Stack gap={16} {...(loading ? { "aria-busy": true } : {})}>
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
              {metric.info === undefined ? (
                <Text variant="label" tone="muted">
                  {metric.label}
                </Text>
              ) : (
                <Stack
                  direction="row"
                  align="center"
                  justify={{ base: "start", sm: "end" }}
                  gap={4}
                >
                  <Text variant="label" tone="muted">
                    {metric.label}
                  </Text>
                  <InfoTip label={metric.info.label}>
                    {metric.info.text}
                  </InfoTip>
                </Stack>
              )}
            </dt>
            <dd {...stylex.props(styles.part, styles.column)}>
              {loading ? (
                <Skeleton shape="line" variant="metric" width="full" />
              ) : (
                <>
                  <Text
                    variant="metric"
                    as="span"
                    numeric
                    tone={metric.tone ?? "default"}
                  >
                    {metric.value}
                  </Text>
                  {metric.caption !== undefined && (
                    <Text variant="caption" tone="muted" numeric>
                      {metric.caption}
                    </Text>
                  )}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </Stack>
  </Card>
);

// Each figure is a direct group of the list, so screen readers pair its
// term and description. Below `sm` the hero takes its own line and the
// side figures wrap under it; from `sm` they share the row, the hero
// growing so the figures sit right.
const styles = stylex.create({
  figures: {
    margin: 0,
    gap: space[16],
    alignItems: "flex-start",
    display: "flex",
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
