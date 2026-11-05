import type { ReactNode } from "react";
import {
  Badge,
  Box,
  Card,
  DetailList,
  DetailRow,
  Metric,
  MetricGroup,
  Stack,
  Text,
} from "../../../../../ui/index";
import type { PositionOverviewModel } from "../../../model/position-overview";

/** One side of the position details split view: its actions or its facts. */
export const PositionDetailsPane = ({
  children,
  kind,
}: {
  readonly children: ReactNode;
  readonly kind: "actions" | "info";
}) =>
  kind === "actions" ? (
    <Box grow maxWidth="sm">
      <Stack gap={16}>{children}</Stack>
    </Box>
  ) : (
    <Box grow>
      <Stack gap={32}>{children}</Stack>
    </Box>
  );

/** The back button, then the trail from the positions list to this position. */
export const PositionDetailsBreadcrumb = ({
  backButton,
  positionName,
  rootLabel,
}: {
  readonly backButton: ReactNode;
  readonly positionName: string | null;
  readonly rootLabel: string;
}) => (
  <Stack direction="row" align="center" gap={8}>
    {backButton}
    <Text weight="semibold">{rootLabel}</Text>
    {positionName ? (
      <Text tone="muted" truncate>
        {`/ ${positionName}`}
      </Text>
    ) : null}
  </Stack>
);

type MetricCard = PositionOverviewModel["metricCards"][number];

/**
 * A card's value: its lines, or the status it names as a badge. A status that
 * asks something of the user wears the warning tone, as the positions list and
 * the Manage tab's count do.
 */
const MetricValue = ({ card }: { readonly card: MetricCard }) => {
  if (typeof card.value === "string") {
    if (card.tone === "action") {
      return <Badge tone="warning">{card.value}</Badge>;
    }
    return card.value;
  }

  return (
    <Stack as="span">
      {card.value.map((line) => (
        <Text key={line} variant="metric">
          {line}
        </Text>
      ))}
    </Stack>
  );
};

/** The position's headline figures, two to a row, each label above its value. */
export const PositionMetricCards = ({
  cards,
}: {
  readonly cards: ReadonlyArray<MetricCard>;
}) => (
  <Card padding={16}>
    <MetricGroup columns={2}>
      {cards.map((card) => (
        <Metric
          key={card.id}
          label={card.label}
          value={<MetricValue card={card} />}
          {...(card.subValue ? { caption: card.subValue } : {})}
        />
      ))}
    </MetricGroup>
  </Card>
);

/** The position's balance types, each with its amount and context. */
export const PositionBreakdownRows = ({
  rows,
}: {
  readonly rows: PositionOverviewModel["breakdownRows"];
}) => (
  <DetailList>
    {rows.map((row) => (
      <DetailRow
        key={row.id}
        label={row.label}
        value={row.value}
        {...(row.subValue ? { caption: row.subValue } : {})}
      />
    ))}
  </DetailList>
);
