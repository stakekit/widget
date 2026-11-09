import { useTrackPage } from "../../../../tracking/index";
import { useExitReview } from "../hooks/use-exit-review.hook";
import { getPositionActionReviewProps, ReviewPage } from "./common.page.tsx";

export const ExitReviewPage = () => {
  const review = useExitReview();

  useTrackPage("unstakeReview");

  return (
    <ReviewPage
      {...getPositionActionReviewProps(review)}
      withdrawalFee={review.withdrawalFee}
      kyc={{
        gate: review.kycGate,
        isChecking: review.kycStatusIsChecking,
        onCheckStatus: review.onKycStatusRefresh,
        providerName: review.kycProviderName,
      }}
      {...review.metaInfo}
    />
  );
};
