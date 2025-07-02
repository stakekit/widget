import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePositionBalances } from "../../../hooks/use-position-balances";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useExitStakeStore } from "../../../providers/exit-stake-store";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const { plain } = useUnstakeOrPendingActionParams();
  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(
      () => Maybe.of(exitRequest.integrationData),
      [exitRequest.integrationData]
    ),
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
  });

  return (
    <StepsPage
      session={exitRequest.actionDto.unsafeCoerce()}
      providersDetails={providersDetails}
    />
  );
};
