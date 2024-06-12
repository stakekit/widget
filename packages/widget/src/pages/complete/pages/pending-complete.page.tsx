import { useUnstakeOrPendingActionParams } from "@sk-widget/hooks/navigation/use-unstake-or-pending-action-params";
import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { usePositionBalances } from "@sk-widget/hooks/use-position-balances";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const PendingCompletePage = () => {
  const { plain } = useUnstakeOrPendingActionParams();
  const positionBalances = usePositionBalances({
    balanceId: plain.balanceId,
    integrationId: plain.integrationId,
  });

  const { pendingActionData, amount, pendingActionType } =
    usePendingActionData();

  const integrationData = Maybe.of(pendingActionData).map(
    (val) => val.integrationData
  );

  const token = Maybe.of(pendingActionData).map((val) => val.interactedToken);

  useTrackPage("pendingActionCompelete");

  const providerDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((p) =>
      p.type === "validators" ? p.validatorsAddresses : []
    ),
  });

  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const _amount = useMemo(
    () => amount.mapOrDefault((v) => formatNumber(v), ""),
    [amount]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  const _pendingActionType = pendingActionType.extract();

  return (
    <CompletePage
      providersDetails={providerDetails}
      yieldType={yieldType}
      token={token}
      metadata={metadata}
      network={network}
      amount={_amount}
      pendingActionType={_pendingActionType}
    />
  );
};
