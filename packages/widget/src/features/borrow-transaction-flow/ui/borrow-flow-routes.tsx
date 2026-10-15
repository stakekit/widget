import type { ReactElement } from "react";
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
  /**
   * Wraps the flow pages inside the mounted Flow Session, so a layout can
   * render panes that describe the Session's own intake.
   */
  readonly layout?: ReactElement;
}>;

const flowPages = (
  <>
    <Route element={<BorrowTransactionFlowReviewRoute />}>
      <Route path="review" element={<BorrowReviewPage />} />
    </Route>
    <Route element={<BorrowTransactionFlowExecutionScope />}>
      <Route path="steps" element={<BorrowStepsPage />} />
      <Route element={<BorrowTransactionFlowCompletionGuard />}>
        <Route path="complete" element={<BorrowCompletePage />} />
      </Route>
    </Route>
  </>
);

export const createBorrowTransactionFlowRoutes = ({
  entry,
  layout,
}: BorrowTransactionFlowRouteMount) => (
  <Route element={<BorrowTransactionFlowRoute expected={entry} />}>
    {layout ? <Route element={layout}>{flowPages}</Route> : flowPages}
  </Route>
);
