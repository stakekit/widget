import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  PositionBalancesKey,
  positionBalancesAtom,
} from "../../../hooks/api/position-atoms";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useExitStakeRequest } from "../../../providers/exit-stake-store";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  const exitRequest = useExitStakeRequest()!;

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
    integrationData: exitRequest.integrationData,
    validators:
      positionBalances?.type === "validators"
        ? positionBalances.validators
        : null,
    selectedProviderYieldId: null,
  });

  return (
    <StepsPage
      inputToken={exitRequest.unstakeToken}
      session={exitRequest.actionDto!}
      providersDetails={providersDetails}
    />
  );
};
