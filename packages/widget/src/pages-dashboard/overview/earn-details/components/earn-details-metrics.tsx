import { Box } from "../../../../components/atoms/box";
import { Text } from "../../../../components/atoms/typography/text";
import type { EarnDetailsMetricCard } from "../earn-details-model";
import * as styles from "../styles.css";

export const EarnDetailsMetrics = ({
  cards,
}: {
  cards: EarnDetailsMetricCard[];
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => (
      <MetricCard key={card.label} {...card} />
    ))}
  </Box>
);

const MetricCard = ({ label, subValue, value }: EarnDetailsMetricCard) => (
  <Box
    className={styles.metricCard}
    display="flex"
    flexDirection="column"
    gap="1"
  >
    <Text
      className={styles.metricLabelText}
      variant={{ type: "muted", weight: "normal" }}
    >
      {label}
    </Text>
    {typeof value === "string" ? (
      <Text className={styles.metricValueText} variant={{ weight: "bold" }}>
        {value}
      </Text>
    ) : (
      <Box>{value}</Box>
    )}
    {subValue && (
      <Text
        className={styles.metricSubValueText}
        variant={{ type: "muted", weight: "normal" }}
      >
        {subValue}
      </Text>
    )}
  </Box>
);
