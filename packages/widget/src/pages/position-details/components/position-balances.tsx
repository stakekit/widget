import type { YieldBalanceDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { isPast } from "date-fns";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import { defaultFormattedNumber } from "../../../utils";
import { formatDurationUntilDate } from "../../../utils/date";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: YieldBalanceDto & { tokenPriceInUsd: BigNumber };
  integrationData: YieldDto;
}) => {
  const { t } = useTranslation();

  const durationUntilDate = useMemo(() => {
    if (
      !yieldBalance.date ||
      (yieldBalance.type !== "unstaking" &&
        yieldBalance.type !== "unlocking" &&
        yieldBalance.type !== "preparing")
    ) {
      return null;
    }

    const date = new Date(yieldBalance.date);

    if (isPast(date)) {
      return t("position_details.unstaking_imminent");
    }

    const duration = formatDurationUntilDate(date);

    if (!duration) {
      return null;
    }

    return t("position_details.unstaking_duration", { duration });
  }, [yieldBalance.date, yieldBalance.type, t]);

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
            {defaultFormattedNumber(new BigNumber(yieldBalance.amount ?? 0))}{" "}
            {yieldBalance.token.symbol}
            {!yieldBalance.token.isPoints &&
              ` ($${defaultFormattedNumber(yieldBalance.tokenPriceInUsd)})`}
          </Text>
        </Box>

        {!!durationUntilDate && (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {durationUntilDate}
          </Text>
        )}
      </Box>
    </Box>
  );
};
