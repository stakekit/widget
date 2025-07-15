import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePositionBalances } from "../../../hooks/use-position-balances";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { usePendingActionStore } from "../../../providers/pending-action-store";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  const pendingRequest = useSelector(
    usePendingActionStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const { plain } = useUnstakeOrPendingActionParams();

  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(
      () => Maybe.of(pendingRequest.integrationData),
      [pendingRequest.integrationData]
    ),
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <StepsPage
      session={pendingRequest.actionDto.unsafeCoerce()}
      providersDetails={providersDetails}
    />
  );
};
