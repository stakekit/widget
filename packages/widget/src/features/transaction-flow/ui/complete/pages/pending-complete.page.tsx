import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { defaultFormattedNumber } from "../../../../../shared/lib";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useProvidersDetails } from "../../../../earn";
import { useYieldType } from "../../../../earn/support";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../portfolio";
import { useTrackPage } from "../../../../tracking";
import { usePendingActionRequest } from "../../../react/use-transaction-flow";
import { CompletePage } from "./common.page";

export const PendingCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const positionBalances = AsyncResult.getOrElse(
    useAtomValue(
      positionBalancesAtom(
        new PositionBalancesKey({
          balanceId: plain.balanceId ?? null,
          yieldId: plain.integrationId ?? null,
        })
      )
    ),
    () => null
  );
  const pendingRequest = usePendingActionRequest()!;
  const integrationData = pendingRequest.integrationData;
  const token = pendingRequest.interactedToken;

  useTrackPage("pendingActionCompelete");

  const providerDetails = useProvidersDetails({
    integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });
  const rawAmount = pendingRequest.requestDto.arguments?.amount;

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
      pendingActionType={pendingRequest.pendingActionType}
      providersDetails={providerDetails}
      token={token}
      yieldType={useYieldType(integrationData)?.type ?? null}
    />
  );
};
