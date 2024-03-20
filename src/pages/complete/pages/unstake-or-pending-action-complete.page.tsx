import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { useMemo } from "react";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { useActionHistoryData } from "../../../providers/stake-history";

export const UnstakeOrPendingActionCompletePage = () => {
  const { positionBalances } = useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();

  const unstakeOrPendingActionHistoryData =
    useActionHistoryData().chainNullable((val) =>
      val.type === "stake" ? null : val
    );

  const integrationData = unstakeOrPendingActionHistoryData.map(
    (v) => v.integrationData
  );

  useTrackPage(
    pendingActionMatch ? "pendingActionCompelete" : "unstakeCompelete"
  );

  const providerDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
  });

  const token = unstakeOrPendingActionHistoryData.map((v) => v.interactedToken);
  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      unstakeOrPendingActionHistoryData.mapOrDefault(
        (v) => formatNumber(v.amount),
        ""
      ),
    [unstakeOrPendingActionHistoryData]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  const pendingActionType = unstakeOrPendingActionHistoryData
    .filter(
      (v): v is Extract<typeof v, { type: "pending_action" }> =>
        v.type === "pending_action"
    )
    .map((val) => val.pendingActionType)
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
