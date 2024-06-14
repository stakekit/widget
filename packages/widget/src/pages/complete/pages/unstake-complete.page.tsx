import { useUnstakeOrPendingActionParams } from "@sk-widget/hooks/navigation/use-unstake-or-pending-action-params";
import { usePositionBalances } from "@sk-widget/hooks/use-position-balances";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const UnstakeCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const { exitRequest } = useStakeExitData();

  const integrationData = useMemo(
    () => Maybe.of(exitRequest.integrationData),
    [exitRequest.integrationData]
  );

  useTrackPage("unstakeCompelete");

  const providerDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
  });

  const token = useMemo(
    () => Maybe.of(exitRequest.unstakeToken),
    [exitRequest.unstakeToken]
  );

  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () => formatNumber(exitRequest.requestDto.args.amount),
    [exitRequest.requestDto.args.amount]
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
    />
  );
};
