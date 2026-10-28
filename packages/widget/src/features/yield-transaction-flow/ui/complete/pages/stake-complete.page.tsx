import { useAtomValue } from "@effect/atom-react";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

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

  return (
    <CompletePage
      amount={formatTokenAmount(
        exactDecimal(enterFlow.request.arguments?.amount ?? 0),
        locale,
        "down"
      )}
      batched={
        isConfidentialYield(selectedStake)
          ? { side: "subscription", yieldDto: selectedStake }
          : null
      }
      integrationId={selectedStake.id}
      metadata={{
        logoURI: selectedStake.metadata.logoURI,
        name: selectedStake.metadata.name,
        provider: selectedStake.provider,
      }}
      network={selectedToken.symbol}
      providersDetails={yieldSummary.providers}
      token={selectedToken}
      yieldType={yieldSummary.yieldType}
    />
  );
};
