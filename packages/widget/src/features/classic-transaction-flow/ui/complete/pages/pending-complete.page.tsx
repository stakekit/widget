import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useProvidersDetails } from "../../../../earn/react/use-provider-details";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../portfolio/resources/positions";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page";

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

  const providerDetails = useProvidersDetails({
    integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });
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
      providersDetails={providerDetails}
      token={token}
      yieldType={useYieldType(integrationData)?.type ?? null}
    />
  );
};
