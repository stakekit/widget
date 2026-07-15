import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useProvidersDetails } from "../../../../earn";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../../portfolio";
import { useTrackPage } from "../../../../tracking";
import { usePendingActionRequest } from "../../../react/use-transaction-flow";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  const pendingRequest = usePendingActionRequest()!;

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

  const providersDetails = useProvidersDetails({
    integrationData: pendingRequest.integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });

  return (
    <StepsPage
      inputToken={pendingRequest.interactedToken}
      session={pendingRequest.actionDto!}
      providersDetails={providersDetails}
    />
  );
};
