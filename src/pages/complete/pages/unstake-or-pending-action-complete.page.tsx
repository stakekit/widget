import { useUnstakeOrPendingActionParams } from "@sk-widget/hooks/navigation/use-unstake-or-pending-action-params";
import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { usePositionBalances } from "@sk-widget/hooks/use-position-balances";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import { useMemo } from "react";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const UnstakeOrPendingActionCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const pendingActionMatch = usePendingActionMatch();

  const stakeExitData = useStakeExitData();
  const pendingActionData = usePendingActionData();

  const integrationData = pendingActionMatch
    ? pendingActionData.pendingActionData.map((val) => val.integrationData)
    : stakeExitData.stakeExitData.map((val) => val.integrationData);

  useTrackPage(
    pendingActionMatch ? "pendingActionCompelete" : "unstakeCompelete"
  );

  const providerDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
  });

  const token = pendingActionMatch
    ? pendingActionData.pendingActionData.map((val) => val.interactedToken)
    : stakeExitData.stakeExitData.map((val) => val.interactedToken);
  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      (pendingActionMatch
        ? pendingActionData.amount
        : stakeExitData.amount
      ).mapOrDefault((v) => formatNumber(v), ""),
    [pendingActionData.amount, pendingActionMatch, stakeExitData.amount]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  const pendingActionType = pendingActionData.pendingActionType.extract();

  return (
    <CompletePage
      providersDetails={providerDetails}
      yieldType={yieldType}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingActionType}
    />
  );
};
