import { useAtomValue } from "@effect/atom-react";
import { useLocation } from "react-router";

import { useWidgetRouteState } from "../../navigation/index";
import {
  makeTransactionFlowContext,
  useOptionalAtomValue,
} from "../../transaction-flow/index";
import { type BorrowFlowSession, borrowFlowRoutes } from "../model/session";
import {
  BorrowFlowExecutionKey,
  type BorrowFlowExecutionPage,
  borrowFlowExecutionPage,
} from "../state/execution-page";
import {
  BorrowFlowReviewVisit,
  borrowFlowReviewPage,
} from "../state/review-page";

export const {
  context: BorrowFlowSessionContext,
  useValue: useBorrowFlowSession,
} = makeTransactionFlowContext<BorrowFlowSession>("Borrow Flow Session");

/** The Execution Steps and Complete show, which their route provides. */
export const {
  context: BorrowFlowExecutionContext,
  useValue: useProvidedBorrowFlowExecution,
} = makeTransactionFlowContext<BorrowFlowExecutionPage>(
  "Borrow Flow Execution"
);

/** This visit's Review: the same Atoms for every render of it. */
export const useBorrowFlowReview = () =>
  useAtomValue(
    borrowFlowReviewPage(
      new BorrowFlowReviewVisit({
        session: useBorrowFlowSession(),
        visit: useLocation().key,
      })
    )
  );

/** The action Steps and Complete were navigated to run, if any. */
export const useBorrowFlowExecutionActionId = () => {
  const { intake } = useBorrowFlowSession();
  return (
    useWidgetRouteState(borrowFlowRoutes[intake.entry._tag])
      ?.executionActionId ?? null
  );
};

/**
 * The Execution of the action Steps and Complete were navigated to run;
 * null without one.
 */
export const useNavigatedBorrowFlowExecution =
  (): BorrowFlowExecutionPage | null => {
    const actionId = useBorrowFlowExecutionActionId();
    const session = useBorrowFlowSession();
    return useOptionalAtomValue(
      borrowFlowExecutionPage,
      actionId === null
        ? null
        : new BorrowFlowExecutionKey({ actionId, session })
    );
  };
