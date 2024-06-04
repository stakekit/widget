import { useUnstakeOrPendingActionReview } from "@sk-widget/pages/review/hooks/use-unstake-or-pending-action-review.hook";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ReviewPage } from "./common.page";

export const UnstakeOrPendingActionReviewPage = () => {
  const {
    pendingActionMatch,
    amount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
    isGasCheckError,
    token,
    metaInfo,
  } = useUnstakeOrPendingActionReview();

  useTrackPage(pendingActionMatch ? "pendingActionReview" : "unstakeReview");

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
      {...metaInfo}
    />
  );
};
