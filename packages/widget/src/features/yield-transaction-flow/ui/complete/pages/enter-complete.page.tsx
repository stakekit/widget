import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { getYieldOutputAmount } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const EnterCompletePage = () => {
  useTrackPage("stakeComplete");

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const enterFlow = useYieldFlowIntake("Enter");
  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;
  const yieldSummary = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: selectedStake,
        validators: new Map(enterFlow.selectedValidators),
      })
    )
  );
  const amount = exactDecimal(enterFlow.request.arguments?.amount ?? 0);
  const batched = isConfidentialYield(selectedStake);
  // A batched deposit receives its shares once the batch settles.
  const received = batched ? null : getYieldOutputAmount(selectedStake, amount);

  return (
    <CompletePage
      amount={formatTokenAmount(amount, locale, "down")}
      batched={
        batched ? { side: "subscription", yieldDto: selectedStake } : null
      }
      integrationId={selectedStake.id}
      network={selectedToken.symbol}
      providersDetails={yieldSummary.providers}
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
      yieldType={yieldSummary.yieldType}
    />
  );
};
