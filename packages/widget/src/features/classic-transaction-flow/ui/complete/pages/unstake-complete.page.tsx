import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../portfolio/resources/positions";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { YieldSummaryKey } from "../../../../yield-summary";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { classicFlowYieldSummaryAtom } from "../../../state/yield-summary";
import { CompletePage } from "./common.page";

export const UnstakeCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const exitFlow = useClassicFlowIntake("Exit");
  const positionBalances = AsyncResult.getOrElse(
    useAtomValue(
      positionBalancesAtom(
        new PositionBalancesKey({
          balanceId: plain.balanceId ?? null,
          scope: exitFlow.walletScope,
          yieldId: plain.integrationId ?? null,
        })
      )
    ),
    () => null
  );
  const integrationData = exitFlow.integration;
  const token = exitFlow.unstakeToken;

  useTrackPage("unstakeComplete");

  const yieldSummary = useAtomValue(
    classicFlowYieldSummaryAtom(
      new YieldSummaryKey({
        yield: integrationData,
        validators:
          positionBalances?.type === "validators"
            ? positionBalances.validators
            : null,
        selectedProviderYieldId: null,
      })
    )
  );

  return (
    <CompletePage
      amount={defaultFormattedNumber(exitFlow.request.arguments?.amount ?? 0)}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      providersDetails={yieldSummary.providers}
      token={token}
      yieldType={yieldSummary.yieldType}
    />
  );
};
