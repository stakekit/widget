import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../components";
import { formatNumber } from "../../../utils";
import BigNumber from "bignumber.js";
import { YieldBalanceDto } from "@stakekit/api-hooks";
import { useMemo } from "react";
import { daysUntilDate } from "../../../utils/date";

export const PositionBalances = ({
  val,
}: {
  val: YieldBalanceDto & { tokenPriceInUsd: BigNumber };
}) => {
  const { t } = useTranslation();

  const unstakingDays = useMemo(() => {
    return val.type === "unstaking" && val.date
      ? daysUntilDate(new Date(val.date))
      : null;
  }, [val.date, val.type]);

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="4"
    >
      <Text variant={{ weight: "normal" }}>
        {t(`position_details.balance_type.${val.type}`)}
      </Text>
      <Box textAlign="end">
        <Text variant={{ type: "muted", weight: "normal" }}>
          {formatNumber(new BigNumber(val.amount ?? 0))} {val.token.symbol} ($
          {formatNumber(val.tokenPriceInUsd, 2)})
        </Text>

        {val.type === "unstaking" && typeof unstakingDays === "number" && (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("position_details.unstaking_days", {
              count: unstakingDays,
            })}
          </Text>
        )}
      </Box>
    </Box>
  );
};
