import { Metric, MetricGroup } from "../../../../../../ui/index";
import type { EarnDetailsMetricCard } from "../earn-details-model";

export const EarnDetailsMetrics = ({
  cards,
}: {
  cards: EarnDetailsMetricCard[];
}) => (
  <MetricGroup>
    {cards.map((card) => (
      <Metric
        key={card.label}
        label={card.label}
        value={card.value}
        {...(card.subValue === undefined ? {} : { caption: card.subValue })}
      />
    ))}
  </MetricGroup>
);
