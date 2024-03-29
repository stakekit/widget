import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { useMemo } from "react";
import { formatNumber } from "../../../utils";
import BigNumber from "bignumber.js";
import { CompletePage } from "./common.page";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";

export const UnstakeOrPendingActionCompletePage = () => {
  const {
    integrationData,
    unstakeAmount,
    pendingActionSession,
    pendingActionToken,
    positionBalances,
  } = useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();

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
    ? pendingActionToken
    : integrationData.map((d) => d.token);
  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      pendingActionMatch
        ? pendingActionSession.mapOrDefault(
            (val) => formatNumber(new BigNumber(val.amount ?? 0)),
            ""
          )
        : formatNumber(unstakeAmount),
    [pendingActionMatch, pendingActionSession, unstakeAmount]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  const pendingActionType = pendingActionSession
    .map((val) => val.type)
    .extract();

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
