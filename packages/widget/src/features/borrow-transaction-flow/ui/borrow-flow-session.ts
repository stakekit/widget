import { useAtomValue } from "@effect/atom-react";
import { createContext, useContext } from "react";
import { useLocation } from "react-router";

import { useWidgetRouteState } from "../../navigation/index";
import { type BorrowFlowSession, borrowFlowRoutes } from "../model/session";
import {
  BorrowFlowExecutionKey,
  borrowFlowExecutionPage,
} from "../state/execution-page";
import {
  BorrowFlowReviewVisit,
  borrowFlowReviewPage,
} from "../state/review-page";

export const BorrowFlowSessionContext = createContext<BorrowFlowSession | null>(
  null
);

export const useBorrowTransactionFlow = (): BorrowFlowSession => {
  const session = useContext(BorrowFlowSessionContext);
  if (!session) throw new Error("Borrow Flow Session is unavailable.");
  return session;
};

/** This visit's Review: the same Atoms for every render of it. */
export const useBorrowTransactionFlowReview = () =>
  useAtomValue(
    borrowFlowReviewPage(
      new BorrowFlowReviewVisit({
        session: useBorrowTransactionFlow(),
        visit: useLocation().key,
      })
    )
  );

/** The action Steps and Complete were navigated to run, if any. */
export const useBorrowFlowExecutionActionId = () => {
  const { intake } = useBorrowTransactionFlow();
  return (
    useWidgetRouteState(borrowFlowRoutes[intake.entry._tag])
      ?.executionActionId ?? null
  );
};

/** The Execution of the action Steps and Complete were navigated to run. */
export const useBorrowTransactionFlowExecution = () => {
  const actionId = useBorrowFlowExecutionActionId();
  const session = useBorrowTransactionFlow();
  if (!actionId) throw new Error("Borrow Flow Execution is unavailable.");
  return useAtomValue(
    borrowFlowExecutionPage(new BorrowFlowExecutionKey({ actionId, session }))
  );
};
