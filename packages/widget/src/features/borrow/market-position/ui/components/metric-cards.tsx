import type BigNumber from "bignumber.js";
import { Metric, MetricGroup } from "../../../../../ui/index";
import type { getBorrowPositionDetailsModel } from "../../model/details";

const getHealthTone = (
  healthFactor: BigNumber | null | undefined
): "default" | "warning" | "danger" => {
  if (healthFactor == null) return "default";
  if (healthFactor.isLessThan(1)) return "danger";
  if (healthFactor.isLessThan(2)) return "warning";
  return "default";
};

export const MetricCards = ({
  cards,
  healthFactor,
}: {
  readonly cards: ReturnType<
    typeof getBorrowPositionDetailsModel
  >["metricCards"];
  readonly healthFactor: BigNumber | null | undefined;
}) => {
  const healthTone = getHealthTone(healthFactor);

  return (
    <MetricGroup columns={2}>
      {cards.map((card) => (
        <Metric
          key={card.id}
          label={card.label}
          value={card.value}
          valueTone={card.id === "health-factor" ? healthTone : "default"}
          {...(card.subValue ? { caption: card.subValue } : {})}
        />
      ))}
    </MetricGroup>
  );
};
