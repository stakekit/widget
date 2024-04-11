import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useUnstakeOrPendingActionReview } from "../hooks/use-unstake-or-pending-action-review.hook";
import { ReviewPage } from "./common.page";
import { List, Maybe } from "purify-ts";

export const UnstakeOrPendingActionReviewPage = () => {
  const {
    pendingActionMatch,
    amount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
    isGasCheckError,
  } = useUnstakeOrPendingActionReview();

  useTrackPage(pendingActionMatch ? "pendingActionReview" : "unstakeReview");

  const token = useMemo(
    () =>
      integrationData.chain((val) =>
        Maybe.fromPredicate(
          (v) => v.metadata.type === "liquid-staking" && !pendingActionMatch,
          val
        )
          .chainNullable((val) => val.metadata.rewardTokens)
          .chain(List.head)
          .alt(Maybe.of(val.token))
      ),
    [integrationData, pendingActionMatch]
  );

  const info = useMemo(
    () =>
      Maybe.fromRecord({ token, amount })
        .map((val) => `${val.amount} ${val.token.symbol}`)
        .extractNullable(),
    [amount, token]
  );

  return (
    <ReviewPage
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      title={title.orDefault("")}
      fee={fee}
      info={info}
      metadata={integrationData.map((d) => d.metadata)}
      token={token}
      isGasCheckError={isGasCheckError}
    />
  );
};
