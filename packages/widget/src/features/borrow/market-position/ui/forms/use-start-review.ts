import { useAtomSet } from "@effect/atom-react";
import type { BorrowPositionAction } from "../../model/details";
import {
  makeBorrowPositionActionRouteKey,
  startBorrowPositionActionReviewAtom,
} from "../../state/action-form";

export const useStartBorrowPositionReview = (action: BorrowPositionAction) => {
  const start = useAtomSet(startBorrowPositionActionReviewAtom);

  return () => start(makeBorrowPositionActionRouteKey(action));
};
