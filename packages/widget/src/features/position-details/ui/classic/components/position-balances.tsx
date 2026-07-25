import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { DateTime, Match } from "effect";
import { useTranslation } from "react-i18next";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import {
  getExtendedYieldType,
  isDepositYieldType,
} from "../../../../../domain/types/yields";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { getDisplayDurationUntil } from "../../../../../shared/lib/date";
import { formatUsd } from "../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: EarnBalance & { tokenPriceInUsd: BigNumber };
  integrationData: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const date = yieldBalance.date;
  const isPendingBalance =
    yieldBalance.type === "entering" || yieldBalance.type === "exiting";
  const displayDuration =
    date && isPendingBalance && presentationTime
      ? getDisplayDurationUntil(date, presentationTime.now)
      : undefined;
  const duration = Match.value(displayDuration).pipe(
    Match.when({ unit: "less-than-minute" }, () =>
      t("position_details.duration.less_than_minute")
    ),
    Match.when({ unit: Match.any }, ({ unit, value }) =>
      t(`position_details.duration.${unit}`, { count: value })
    ),
    Match.orElse(() => null)
  );
  const durationUntilDate = Match.value(
    date && isPendingBalance && presentationTime
      ? { date, now: presentationTime.now, duration }
      : null
  ).pipe(
    Match.when(null, () => null),
    Match.when(
      ({ date, now }) => DateTime.isLessThanOrEqualTo(date, now),
      () => t("position_details.unstaking_imminent")
    ),
    Match.when({ duration: Match.defined }, ({ duration }) =>
      t("position_details.unstaking_duration", { duration })
    ),
    Match.orElse(() => null)
  );

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
              ` (${formatUsd(yieldBalance.tokenPriceInUsd)})`}
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
