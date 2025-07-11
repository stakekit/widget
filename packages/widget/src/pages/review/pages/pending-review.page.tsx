import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePendingActionReview } from "../hooks/use-pending-review.hook";
import { ReviewPage } from "./common-page/common.page";

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
    () => token.map((val) => `${amount} ${val.symbol}`).extractNullable(),
    [amount, token]
  );

  const { depositFee, managementFee, performanceFee, feeConfigLoading } =
    useMemo(
      () => ({
        depositFee: Maybe.empty(),
        managementFee: Maybe.empty(),
        performanceFee: Maybe.empty(),
        feeConfigLoading: false,
      }),
      []
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
