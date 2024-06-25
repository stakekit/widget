import type { YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../components";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { formatNumber } from "../../../utils";
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
        <Box display="flex" gap="1" alignItems="center">
          {yieldBalance.token.isPoints && (
            <Box as="span" display="inline-flex">
              <TokenIcon
                token={yieldBalance.token}
                hideNetwork
                tokenLogoHw="5"
              />
            </Box>
          )}
          <Text
            overflowWrap="anywhere"
            variant={{ type: "muted", weight: "normal" }}
          >
            {formatNumber(new BigNumber(yieldBalance.amount ?? 0))}{" "}
            {yieldBalance.token.symbol}
            {!yieldBalance.token.isPoints &&
              ` ($${formatNumber(yieldBalance.tokenPriceInUsd, 6)})`}
          </Text>
        </Box>

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
