import { useMatch, useParams } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { useMemo } from "react";
import { formatNumber } from "../../utils";
import BigNumber from "bignumber.js";
import { CompletePage } from "./common.page";
import { Maybe } from "purify-ts";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { useYieldType } from "../../hooks/use-yield-type";
import { useProviderDetails } from "../../hooks/use-provider-details";

export const UnstakeOrPendingActionCompletePage = () => {
  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  const integrationId = useParams<{ integrationId: string }>().integrationId!;

  const yieldOpportunity = useYieldOpportunity(integrationId);
  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const providerDetails = useProviderDetails({
    integrationData,
    validatorAddress: Maybe.fromNullable(
      pendingActionMatch?.params.defaultOrValidatorId
    ),
  });

  const token = integrationData.map((d) => d.token);
  const metadata = integrationData.map((d) => d.metadata);
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      pendingActionMatch
        ? pendingActionSession.mapOrDefault(
            (val) => formatNumber(new BigNumber(val.amount ?? 0)),
            ""
          )
        : unstake
            .chain((u) => u.amount)
            .mapOrDefault((a) => formatNumber(a), ""),
    [pendingActionMatch, pendingActionSession, unstake]
  );

  const yieldType = useYieldType(integrationData).map((v) => v.type);

  const pendingActionType = pendingActionSession
    .map((val) => val.type)
    .extract();

  return (
    <CompletePage
      providerDetails={providerDetails}
      yieldType={yieldType}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingActionType}
    />
  );
};
