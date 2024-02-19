import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useUnstakeOrPendingActionReview } from "../hooks/use-unstake-or-pending-action-review.hook";
import { ReviewPage } from "./common.page";
import { Maybe } from "purify-ts";

export const UnstakeOrPendingActionReviewPage = () => {
  const {
    pendingActionMatch,
    amount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
  } = useUnstakeOrPendingActionReview();

  useTrackPage(pendingActionMatch ? "pendingActionReview" : "unstakeReview");

  const info = useMemo(
    () =>
      Maybe.fromRecord({ integrationData, amount })
        .map((val) => `${val.amount} ${val.integrationData.token.symbol}`)
        .extractNullable(),
    [amount, integrationData]
  );

  return (
    <ReviewPage
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      title={title.orDefault("")}
      fee={fee}
      info={info}
      metadata={integrationData.map((d) => d.metadata)}
      token={integrationData.map((d) => d.token)}
    />
  );
};
