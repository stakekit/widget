import type BigNumber from "bignumber.js";
import { PositionMetricCards } from "../../../../../shared/ui/components/position-details";
import type { getBorrowPositionDetailsModel } from "../../model/details";
import * as styles from "../styles.css";

export const MetricCards = ({
  cards,
  healthFactor,
}: {
  readonly cards: ReturnType<
    typeof getBorrowPositionDetailsModel
  >["metricCards"];
  readonly healthFactor: BigNumber | null | undefined;
}) => {
  const positionCards = cards.map((card) => {
    const isHealthCard = card.id === "health-factor";
    const getToneClass = () => {
      if (!isHealthCard || healthFactor == null) return undefined;
      if (healthFactor.isLessThan(1)) return styles.healthValueDanger;
      if (healthFactor.isLessThan(2)) return styles.healthValueWarning;
      return styles.healthValue;
    };
    const toneClass = getToneClass();

    return { ...card, valueClassName: toneClass };
  });

  return <PositionMetricCards cards={positionCards} />;
};
