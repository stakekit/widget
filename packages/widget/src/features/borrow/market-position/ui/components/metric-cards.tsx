import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import { PositionMetricCards } from "../../../../../shared/ui/components/position-details";
import type { getBorrowPositionDetailsModel } from "../../model/details";
import * as styles from "../styles.css";

export const MetricCards = (
  props:
    | { readonly loading: true }
    | {
        readonly loading?: false;
        readonly cards: ReturnType<
          typeof getBorrowPositionDetailsModel
        >["metricCards"];
        readonly healthFactor: BigNumber | null | undefined;
      }
) => {
  const { t } = useTranslation();

  if (props.loading) {
    return (
      <PositionMetricCards
        cards={[
          {
            id: "net-worth",
            label: t("dashboard.borrow.position_details.net_worth"),
            loading: true,
            value: null,
          },
          {
            id: "debt",
            label: t("dashboard.borrow.position_details.debt"),
            loading: true,
            value: null,
          },
        ]}
      />
    );
  }

  const { cards, healthFactor } = props;
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
