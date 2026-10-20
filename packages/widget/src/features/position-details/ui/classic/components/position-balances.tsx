import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  getExtendedYieldType,
  isDepositYieldType,
} from "../../../../../domain/earn/yield";
import type { PositionBalanceRow } from "../../../../../domain/portfolio/positions";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { formatPendingBalanceTiming } from "../../../model/pending-balance-timing";

export const PositionBalances = ({
  yieldBalance,
  integrationData,
}: {
  yieldBalance: PositionBalanceRow;
  integrationData: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const durationUntilDate = formatPendingBalanceTiming({
    integrationData,
    now: presentationTime?.now ?? null,
    row: yieldBalance,
    t,
  });

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
            {yieldBalance.isEncrypted ? (
              t("shared.confidential.hidden")
            ) : (
              <>
                {formatTokenAmount(yieldBalance.amount, locale, "down")}{" "}
                {yieldBalance.token.symbol}
                {!yieldBalance.token.isPoints &&
                  ` (${formatUsd(yieldBalance.amountUsd, locale)})`}
              </>
            )}
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
