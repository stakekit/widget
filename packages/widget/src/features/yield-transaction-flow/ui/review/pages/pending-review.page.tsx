import { useTrackPage } from "../../../../tracking/index";
import { usePendingActionReview } from "../hooks/use-pending-review.hook";
import {
  getPositionActionReviewProps,
  ReviewPage,
} from "./common-page/common.page.tsx";

export const PendingReviewPage = () => {
  const review = usePendingActionReview();

  useTrackPage("pendingActionReview");

  return (
    <ReviewPage
      {...getPositionActionReviewProps(review)}
      {...review.metaInfo}
    />
  );
};
