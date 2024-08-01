import { usePendingActionReview } from "@sk-widget/pages/review/hooks/use-pending-review.hook";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { ReviewPage } from "./common.page";

export const PendingReviewPage = () => {
  const {
    formattedAmount,
    fee,
    integrationData,
    rewardTokenDetailsProps,
    title,
    token,
    metaInfo,
    gasCheckLoading,
    isGasCheckWarning,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading,
  } = usePendingActionReview();

  useTrackPage("pendingActionReview");

  const info = useMemo(
    () =>
      Maybe.fromRecord({ token, formattedAmount })
        .map((val) => `${val.formattedAmount} ${val.token.symbol}`)
        .extractNullable(),
    [formattedAmount, token]
  );

  return (
    <ReviewPage
      rewardTokenDetailsProps={rewardTokenDetailsProps}
      title={title.orDefault("")}
      fee={fee}
      depositFee={depositFee}
      managementFee={managementFee}
      performanceFee={performanceFee}
      feeConfigLoading={feeConfigLoading}
      info={info}
      metadata={integrationData.map((val) => val.metadata)}
      token={token}
      isGasCheckError={isGasCheckWarning}
      loading={gasCheckLoading}
      {...metaInfo}
    />
  );
};
