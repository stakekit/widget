import { useAtomValue } from "@effect/atom-react";
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
import { useExitStakeRequest } from "../../../react/use-transaction-flow";
import { CompletePage } from "./common.page";

export const UnstakeCompletePage = () => {
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
  const exitRequest = useExitStakeRequest()!;
  const integrationData = exitRequest.integrationData;
  const token = exitRequest.unstakeToken;

  useTrackPage("unstakeComplete");

  const providerDetails = useProvidersDetails({
    integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });

  return (
    <CompletePage
      amount={defaultFormattedNumber(
        exitRequest.requestDto.arguments?.amount ?? 0
      )}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      providersDetails={providerDetails}
      token={token}
      yieldType={useYieldType(integrationData)?.type ?? null}
    />
  );
};
