import { useTrackPage } from "../../../../tracking/index";
import type { YieldFlowReviewVariant } from "../../../state/review-page";
import { usePendingActionReview } from "../hooks/use-pending-review.hook";
import { getPositionActionReviewProps, ReviewPage } from "./common.page.tsx";

export const PendingReviewPage = ({
  review: model,
}: {
  readonly review: YieldFlowReviewVariant<"Manage">;
}) => {
  const review = usePendingActionReview(model);

  useTrackPage("pendingActionReview");

  return (
    <ReviewPage
      {...getPositionActionReviewProps(review)}
      {...review.metaInfo}
    />
  );
};
