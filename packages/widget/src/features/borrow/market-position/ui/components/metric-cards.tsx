import { Metric, MetricGroup } from "../../../../../ui/index";
import type { BorrowPositionMetricCard } from "../../model/details";

export const MetricCards = ({
  cards,
}: {
  readonly cards: ReadonlyArray<BorrowPositionMetricCard>;
}) => (
  <MetricGroup columns={2}>
    {cards.map((card) => (
      <Metric
        key={card.id}
        label={card.label}
        value={card.value}
        valueTone={card.tone ?? "default"}
        {...(card.subValue ? { caption: card.subValue } : {})}
      />
    ))}
  </MetricGroup>
);
