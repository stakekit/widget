import { useTrackPage } from "../../../../tracking/index";
import type { YieldFlowReviewVariant } from "../../../state/review-page";
import { useExitReview } from "../hooks/use-exit-review.hook";
import { getPositionActionReviewProps, ReviewPage } from "./common.page.tsx";

export const ExitReviewPage = ({
  review: model,
}: {
  readonly review: YieldFlowReviewVariant<"Exit">;
}) => {
  const review = useExitReview(model);

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
