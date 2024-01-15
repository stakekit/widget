import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../components";
import { formatNumber } from "../../../utils";
import BigNumber from "bignumber.js";
import { YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";
import { useMemo } from "react";
import { daysUntilDate } from "../../../utils/date";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: YieldBalanceDto & { tokenPriceInUsd: BigNumber };
  integrationData: YieldDto;
}) => {
  const { t } = useTranslation();

  const daysRemaining = useMemo(() => {
    return (yieldBalance.type === "unstaking" ||
      yieldBalance.type === "unlocking") &&
      yieldBalance.date
      ? daysUntilDate(new Date(yieldBalance.date))
      : null;
  }, [yieldBalance.date, yieldBalance.type]);

  const yieldType = integrationData.metadata.type;

  const balanceTypeContext =
    yieldType === "vault" || yieldType === "lending"
      ? "yearn_or_deposit"
      : undefined;

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="4"
    >
      <Text variant={{ weight: "normal" }}>
        {t(`position_details.balance_type.${yieldBalance.type}`, {
          context: balanceTypeContext,
        })}
      </Text>
      <Box textAlign="end">
        <Text variant={{ type: "muted", weight: "normal" }}>
          {formatNumber(new BigNumber(yieldBalance.amount ?? 0))}{" "}
          {yieldBalance.token.symbol} ($
          {formatNumber(yieldBalance.tokenPriceInUsd, 2)})
        </Text>

        {typeof daysRemaining === "number" && (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("position_details.unstaking_days", {
              count: daysRemaining,
            })}
          </Text>
        )}
      </Box>
    </Box>
  );
};
