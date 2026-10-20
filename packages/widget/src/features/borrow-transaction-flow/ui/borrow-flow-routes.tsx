import type { ReactElement } from "react";
import { Route } from "react-router";
import type { BorrowTransactionFlowEntry } from "../model/borrow-transaction-flow";
import {
  BorrowTransactionFlowExecutionPage,
  BorrowTransactionFlowExecutionRoute,
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
    <Route path="review" element={<BorrowReviewPage />} />
    <Route element={<BorrowTransactionFlowExecutionRoute />}>
      <Route
        path="steps"
        element={
          <BorrowTransactionFlowExecutionPage page="Steps">
            <BorrowStepsPage />
          </BorrowTransactionFlowExecutionPage>
        }
      />
      <Route
        path="complete"
        element={
          <BorrowTransactionFlowExecutionPage page="Complete">
            <BorrowCompletePage />
          </BorrowTransactionFlowExecutionPage>
        }
      />
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
