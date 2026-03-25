import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getYieldProviderDetails } from "../../../domain/types/yields";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePositionBalances } from "../../../hooks/use-position-balances";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { usePendingActionStore } from "../../../providers/pending-action-store";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const PendingCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();

  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const pendingRequest = useSelector(
    usePendingActionStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const integrationData = useMemo(
    () => Maybe.of(pendingRequest.integrationData),
    [pendingRequest.integrationData]
  );

  const token = useMemo(
    () => Maybe.of(pendingRequest.interactedToken),
    [pendingRequest.interactedToken]
  );

  useTrackPage("pendingActionCompelete");

  const providerDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
    selectedProviderYieldId: Maybe.empty(),
  });

  const metadata = integrationData.map((yieldDto) => ({
    logoURI: yieldDto.metadata.logoURI,
    name: yieldDto.metadata.name,
    provider: getYieldProviderDetails(yieldDto) ?? undefined,
  }));
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      Maybe.fromNullable(pendingRequest.requestDto.arguments?.amount)
        .map((val) => new BigNumber(val ?? 0))
        .mapOrDefault((v) => formatNumber(v), ""),
    [pendingRequest.requestDto.arguments?.amount]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  return (
    <CompletePage
      providersDetails={providerDetails}
      yieldType={yieldType}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingRequest.pendingActionType}
      integrationId={pendingRequest.integrationData.id}
    />
  );
};
