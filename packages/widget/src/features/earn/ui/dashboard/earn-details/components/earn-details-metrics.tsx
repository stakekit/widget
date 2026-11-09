import { Metric, MetricGroup } from "../../../../../../ui/index";
import type { EarnDetailsMetricCard } from "../earn-details-model";

export const EarnDetailsMetrics = ({
  cards,
}: {
  cards: EarnDetailsMetricCard[];
}) => (
  <MetricGroup framed>
    {cards.map((card) => (
      <Metric
        key={card.label}
        label={card.label}
        value={card.value}
        caption={card.subValue}
      />
    ))}
  </MetricGroup>
);
