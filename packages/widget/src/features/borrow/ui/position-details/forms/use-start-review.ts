import { useAtomSet } from "@effect/atom-react";
import type { BorrowPositionAction } from "../../../model/position-details-model";
import {
  makeBorrowPositionActionRouteKey,
  startBorrowPositionActionReviewAtom,
} from "../../../state/position-action-form";

export const useStartBorrowPositionReview = (action: BorrowPositionAction) => {
  const start = useAtomSet(startBorrowPositionActionReviewAtom);

  return () => start(makeBorrowPositionActionRouteKey(action));
};
