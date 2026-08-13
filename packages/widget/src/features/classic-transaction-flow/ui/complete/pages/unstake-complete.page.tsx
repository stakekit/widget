import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../../resources/yield-positions/yield-positions";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useUnstakeOrPendingActionParams } from "../../../../position-details/state";
import { useTrackPage } from "../../../../tracking/state";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/state";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

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
    yieldSummaryAtom(
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
