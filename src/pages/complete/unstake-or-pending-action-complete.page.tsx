import { useMatch, useParams } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { useMemo } from "react";
import { formatTokenBalance } from "../../utils";
import BigNumber from "bignumber.js";
import { CompletePage } from "./common.page";
import { Maybe } from "purify-ts";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";

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

  const token = integrationData.map((d) => d.token);
  const metadata = integrationData.map((d) => d.metadata).extractNullable();
  const network = token.mapOrDefault((t) => t.symbol, "");
  const amount = useMemo(
    () =>
      pendingActionMatch
        ? pendingActionSession.mapOrDefault(
            (val) => formatTokenBalance(new BigNumber(val.amount ?? 0), 6),
            ""
          )
        : unstake
            .chain((u) => u.amount)
            .mapOrDefault((a) => formatTokenBalance(a, 6), ""),
    [pendingActionMatch, pendingActionSession, unstake]
  );

  const pendingActionType = pendingActionSession
    .map((val) => val.type)
    .extract();

  return (
    <CompletePage
      token={token.extractNullable()}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingActionType}
    />
  );
};
