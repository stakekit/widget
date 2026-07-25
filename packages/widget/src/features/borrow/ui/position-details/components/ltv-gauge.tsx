import { useTranslation } from "react-i18next";
import { formatPercent } from "../../../../../shared/lib/formatters";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import * as styles from "../../styles.css";

export const LtvGauge = ({
  currentLtv,
  liquidationThreshold,
}: {
  readonly currentLtv: number | null;
  readonly liquidationThreshold: number | null;
}) => {
  const { t } = useTranslation();

  if (currentLtv == null) {
    return null;
  }

  const clampedLtv = Math.max(0, Math.min(100, currentLtv * 100));
  const clampedThreshold =
    liquidationThreshold == null
      ? null
      : Math.max(0, Math.min(100, liquidationThreshold * 100));

  return (
    <Box className={styles.ltvGauge}>
      <Box display="flex" justifyContent="space-between" gap="2">
        <Text variant={{ weight: "bold" }}>
          {t("dashboard.borrow.position_details.loan_to_value")}
        </Text>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {formatPercent(currentLtv)}
        </Text>
      </Box>

      <Box className={styles.ltvGaugeTrack}>
        {clampedThreshold == null ? null : (
          <Box
            className={styles.ltvGaugeThreshold}
            style={{ left: `${clampedThreshold}%` }}
          />
        )}
        <Box
          className={styles.ltvGaugeMarker}
          style={{ left: `${clampedLtv}%` }}
        />
      </Box>

      <Box className={styles.ltvGaugeLabels}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.borrow.position_details.low_risk")}
        </Text>
        {liquidationThreshold == null ? null : (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.position_details.liquidation_at", {
              value: formatPercent(liquidationThreshold),
            })}
          </Text>
        )}
      </Box>
    </Box>
  );
};
