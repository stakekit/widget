import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { getActionProviderYieldId } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useTrackPage } from "../../../../tracking/state";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/state";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterFlow = useClassicFlowIntake("Enter");
  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;
  const yieldSummary = useAtomValue(
    yieldSummaryAtom(
      new YieldSummaryKey({
        yield: selectedStake,
        validators: new Map(enterFlow.selectedValidators),
        selectedProviderYieldId: getActionProviderYieldId(enterFlow.request),
      })
    )
  );

  return (
    <CompletePage
      amount={defaultFormattedNumber(
        new BigNumber(enterFlow.request.arguments?.amount ?? 0)
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
