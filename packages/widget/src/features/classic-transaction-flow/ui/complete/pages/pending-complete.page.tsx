import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../../resources/yield-positions/index";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useUnstakeOrPendingActionParams } from "../../../../position-details/index";
import { useTrackPage } from "../../../../tracking/index";
import {
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../../yield-summary/index";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

export const PendingCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const manageFlow = useClassicFlowIntake("Manage");
  const positionBalances = AsyncResult.getOrElse(
    useAtomValue(
      positionBalancesAtom(
        new PositionBalancesKey({
          balanceId: plain.balanceId ?? null,
          scope: manageFlow.walletScope,
          yieldId: plain.integrationId ?? null,
        })
      )
    ),
    () => null
  );
  const integrationData = manageFlow.integration;
  const token = manageFlow.interactedToken;

  useTrackPage("pendingActionCompelete");

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
  const rawAmount = manageFlow.request.arguments?.amount;

  return (
    <CompletePage
      amount={rawAmount ? defaultFormattedNumber(new BigNumber(rawAmount)) : ""}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      pendingActionType={manageFlow.pendingActionType}
      providersDetails={yieldSummary.providers}
      token={token}
      yieldType={yieldSummary.yieldType}
    />
  );
};
