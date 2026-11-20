import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useYieldFlowReview } from "./yield-flow-session";

export const useYieldActionContinuationReview = () => {
  const review = useYieldFlowReview();
  const view = useAtomValue(review.confirmViewAtom);
  const confirm = useAtomSet(review.confirmAtom);

  return {
    confirm: () => confirm(undefined),
    disabled: view.confirmDisabled,
    loading: view.confirmLoading,
  } as const;
};
