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
  formatTokenAmountWithSymbol,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { DetailRow } from "../../../../../ui/index";
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
  const shares = yieldBalance.isEncrypted ? null : yieldBalance.shares;

  const balanceTypeOptions = isDepositYieldType(yieldType)
    ? { context: "yearn_or_deposit" }
    : {};

  const value = yieldBalance.isEncrypted
    ? t("shared.confidential.hidden")
    : `${formatTokenAmountWithSymbol(yieldBalance, locale)}${
        yieldBalance.token.isPoints
          ? ""
          : ` (${formatUsd(yieldBalance.amountUsd, locale)})`
      }`;
  const caption = [
    shares ? formatTokenAmountWithSymbol(shares, locale) : null,
    durationUntilDate || null,
  ]
    .filter((line) => line !== null)
    .join(" · ");

  return (
    <DetailRow
      label={t(
        `position_details.balance_type.${yieldBalance.type}`,
        balanceTypeOptions
      )}
      value={value}
      {...(caption ? { caption } : {})}
    />
  );
};
