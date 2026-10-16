import { useAtomValue } from "@effect/atom-react";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const { locale } = useWidgetPresentation();
  const enterFlow = useClassicFlowIntake("Enter");
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
