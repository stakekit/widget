import { usePendingActionReview } from "@sk-widget/pages/review/hooks/use-pending-review.hook";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ReviewPage } from "./common.page";

export const PendingReviewPage = () => {
  const {
    amount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
    token,
    metaInfo,
    gasCheckLoading,
    isGasCheckWarning,
  } = usePendingActionReview();

  useTrackPage("pendingActionReview");

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
      metadata={integrationData.map((val) => val.metadata)}
      token={token}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      {...metaInfo}
    />
  );
};
