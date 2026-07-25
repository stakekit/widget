import { useAtomSet } from "@effect/atom-react";
import { useNavigate } from "react-router";
import type { BorrowTransactionFlowReview } from "../../../../borrow-transaction-flow/state";
import { startBorrowPositionActionReviewAtom } from "../../../state/position-action-form";

export const useStartBorrowPositionReview = () => {
  const navigate = useNavigate();
  const startReview = useAtomSet(startBorrowPositionActionReviewAtom);

  return (reviewState: BorrowTransactionFlowReview) => {
    startReview(reviewState);
    navigate("../review");
  };
};
