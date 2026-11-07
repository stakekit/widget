import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import {
  useYieldFlowExecution,
  useYieldFlowIntake,
} from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const EnterCompletePage = () => {
  useTrackPage("stakeComplete");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const { selectedStake, selectedToken } = useYieldFlowIntake("Enter");
  const { enterCompleteViewAtom } = useYieldFlowExecution();
  if (!enterCompleteViewAtom) {
    throw new Error("Expected Yield Flow Enter intake.");
  }
  const { amount, batched, received, yearlyEarnings, yieldType } = useAtomValue(
    enterCompleteViewAtom
  );

  return (
    <CompletePage
      amount={formatTokenAmount(amount, locale, "down")}
      batched={
        batched ? { side: "subscription", yieldDto: selectedStake } : null
      }
      integrationId={selectedStake.id}
      network={selectedToken.symbol}
      markToken={selectedToken}
      rows={
        received
          ? [
              {
                label: t("complete.you_received"),
                testId: "complete-received",
                value: `${formatTokenAmount(received.amount, locale, "nearest")} ${received.token.symbol}`,
              },
            ]
          : []
      }
      yearlyEarnings={
        yearlyEarnings
          ? {
              value: `+${formatTokenAmount(yearlyEarnings.amount, locale, "nearest")} ${yearlyEarnings.symbol}`,
              ...(yearlyEarnings.usd
                ? { caption: formatUsd(yearlyEarnings.usd, locale) }
                : {}),
            }
          : null
      }
      yieldType={yieldType}
    />
  );
};
