import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import type { YieldFlowExecutionVariant } from "../../../state/execution-page";
import { CompletePage } from "./common.page.tsx";

export const EnterCompletePage = ({
  execution,
}: {
  readonly execution: YieldFlowExecutionVariant<"Enter">;
}) => {
  useTrackPage("stakeComplete");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const { selectedStake, selectedToken } = execution.intake;
  const { amount, batched, received, yearlyEarnings, yieldType } = useAtomValue(
    execution.enterCompleteViewAtom
  );

  return (
    <CompletePage
      execution={execution}
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
