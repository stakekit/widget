import { Route } from "react-router";
import type { BorrowTransactionFlowEntry } from "../model/borrow-transaction-flow";
import {
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowReviewRoute,
  BorrowTransactionFlowRoute,
} from "../react/borrow-flow-route";
import { BorrowCompletePage } from "./complete";
import { BorrowReviewPage } from "./review";
import { BorrowStepsPage } from "./steps";

type BorrowTransactionFlowRouteMount = Readonly<{
  readonly entry: BorrowTransactionFlowEntry["_tag"];
}>;

export const createBorrowTransactionFlowRoutes = ({
  entry,
}: BorrowTransactionFlowRouteMount) => (
  <Route element={<BorrowTransactionFlowRoute expected={entry} />}>
    <Route element={<BorrowTransactionFlowReviewRoute />}>
      <Route path="review" element={<BorrowReviewPage />} />
    </Route>
    <Route element={<BorrowTransactionFlowExecutionScope />}>
      <Route path="steps" element={<BorrowStepsPage />} />
      <Route element={<BorrowTransactionFlowCompletionGuard />}>
        <Route path="complete" element={<BorrowCompletePage />} />
      </Route>
    </Route>
  </Route>
);
