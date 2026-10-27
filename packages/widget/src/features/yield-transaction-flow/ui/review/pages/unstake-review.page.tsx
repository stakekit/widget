import { useTrackPage } from "../../../../tracking/index";
import { useUnstakeActionReview } from "../hooks/use-unstake-review.hook";
import {
  getPositionActionReviewProps,
  ReviewPage,
} from "./common-page/common.page.tsx";
import { UnstakeSignPopup } from "./unstake-sign-popup";

export const UnstakeReviewPage = () => {
  const review = useUnstakeActionReview();

  useTrackPage("unstakeReview");

  return (
    <>
      <ReviewPage
        {...getPositionActionReviewProps(review)}
        kyc={{
          gate: review.kycGate,
          isChecking: review.kycStatusIsChecking,
          onCheckStatus: review.onKycStatusRefresh,
          providerName: review.kycProviderName,
        }}
        {...review.metaInfo}
      />
      <UnstakeSignPopup
        isOpen={review.showUnstakeSignMessagePopup}
        onClick={review.onContinueUnstakeSignMessage}
        onCancel={review.onCloseUnstakeSignMessage}
      />
    </>
  );
};
