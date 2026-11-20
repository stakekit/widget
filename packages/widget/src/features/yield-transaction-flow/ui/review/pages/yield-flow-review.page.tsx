import { useYieldFlowReview } from "../../yield-flow-session";
import { EnterReviewPage } from "./enter-review.page.tsx";
import { ExitReviewPage } from "./exit-review.page.tsx";
import { PendingReviewPage } from "./pending-review.page.tsx";

/** The Review of the Session's intake, each variant with its own model. */
export const YieldFlowReviewPage = () => {
  const review = useYieldFlowReview();
  switch (review._tag) {
    case "Enter":
      return <EnterReviewPage review={review} />;
    case "Exit":
      return <ExitReviewPage review={review} />;
    case "Manage":
      return <PendingReviewPage review={review} />;
    // Activity reviews a continued action itself.
    case "YieldActionContinuation":
      return null;
  }
};
