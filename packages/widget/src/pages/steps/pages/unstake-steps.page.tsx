import { useUnstakeOrPendingActionParams } from "@sk-widget/hooks/navigation/use-unstake-or-pending-action-params";
import { usePositionBalances } from "@sk-widget/hooks/use-position-balances";
import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useExitStakeStore } from "@sk-widget/providers/exit-stake-store";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
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
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <StepsPage
      session={exitRequest.actionDto.unsafeCoerce()}
      providersDetails={providersDetails}
    />
  );
};
