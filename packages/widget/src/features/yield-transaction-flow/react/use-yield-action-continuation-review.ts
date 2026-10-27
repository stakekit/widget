import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useYieldFlowReview } from "./yield-flow-route";

export const useYieldActionContinuationReview = () => {
  const review = useYieldFlowReview();
  const view = useAtomValue(review.activityReviewViewAtom);
  const confirm = useAtomSet(review.confirmAtom);

  return {
    confirm: () => confirm(undefined),
    disabled: view.confirmDisabled,
    loading: view.confirmLoading,
  } as const;
};
