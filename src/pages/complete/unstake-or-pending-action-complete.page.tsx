import { useMatch, useParams } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { usePositionData } from "../../hooks/use-position-data";
import { useMemo } from "react";
import { formatTokenBalance } from "../../utils";
import BigNumber from "bignumber.js";
import { CompletePage } from "./common.page";

export const UnstakeOrPendingActionCompletePage = () => {
  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  const integrationId = useParams<{ integrationId: string }>().integrationId!;

  const { position } = usePositionData(integrationId);

  const token = position.map((p) => p.integrationData.token).extractNullable();
  const metadata = position
    .map((p) => p.integrationData.metadata)
    .extractNullable();
  const network = token?.symbol ?? "";
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
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={pendingActionType}
    />
  );
};
