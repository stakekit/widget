import BigNumber from "bignumber.js";
import { isPast } from "date-fns";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import {
  getExtendedYieldType,
  isDepositYieldType,
} from "../../../../../domain/types/yields";
import { formatDurationUntilDate } from "../../../../../shared/lib/date";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { TokenIcon } from "../../../../widget-shell/ui/token-icon";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: EarnBalance & { tokenPriceInUsd: BigNumber };
  integrationData: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();

  const durationUntilDate = useMemo(() => {
    if (
      !yieldBalance.date ||
      (yieldBalance.type !== "entering" && yieldBalance.type !== "exiting")
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

  const yieldType = getExtendedYieldType(integrationData);

  const balanceTypeContext = isDepositYieldType(yieldType)
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
