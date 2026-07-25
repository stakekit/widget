import clsx from "clsx";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { positionDetailsComponentStyles as positionDetailsStyles } from "../../../../position-details/ui";
import type { getBorrowPositionDetailsModel } from "../../../model/position-details-model";
import * as styles from "../../styles.css";

export const MetricCards = ({
  cards,
  healthFactor,
}: {
  readonly cards: ReturnType<
    typeof getBorrowPositionDetailsModel
  >["metricCards"];
  readonly healthFactor: number | null | undefined;
}) => (
  <Box className={positionDetailsStyles.metricGrid}>
    {cards.map((card) => {
      const isHealthCard = card.id === "health-factor";
      const getToneClass = () => {
        if (!isHealthCard || healthFactor == null) return undefined;
        if (healthFactor < 1) return styles.healthValueDanger;
        if (healthFactor < 2) return styles.healthValueWarning;
        return styles.healthValue;
      };
      const toneClass = getToneClass();

      return (
        <Box
          className={positionDetailsStyles.metricCard({ tone: "default" })}
          display="flex"
          flexDirection="column"
          gap="1"
          key={card.id}
        >
          <Text
            className={positionDetailsStyles.metricLabelText}
            variant={{ type: "muted", weight: "normal" }}
          >
            {card.label}
          </Text>

          {typeof card.value === "string" ? (
            <Text
              className={clsx(
                positionDetailsStyles.metricValueText({
                  tone: "default",
                }),
                toneClass
              )}
              variant={{ weight: "bold" }}
            >
              {card.value}
            </Text>
          ) : (
            <Box>{card.value}</Box>
          )}

          {card.subValue && (
            <Text
              className={positionDetailsStyles.metricSubValueText}
              variant={{ type: "muted", weight: "normal" }}
            >
              {card.subValue}
            </Text>
          )}
        </Box>
      );
    })}
  </Box>
);
