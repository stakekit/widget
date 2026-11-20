import { useAtomValue } from "@effect/atom-react";
import { useLocation } from "react-router";

import { useWidgetRouteState } from "../../navigation/index";
import {
  makeTransactionFlowContext,
  useOptionalAtomValue,
} from "../../transaction-flow/index";
import type { EnterYieldTransactionFlowIntake } from "../model/intake";
import { type YieldFlowSession, yieldFlowRoutes } from "../model/session";
import {
  YieldFlowExecutionKey,
  type YieldFlowExecutionPage,
  yieldFlowExecutionPage,
} from "../state/execution-page";
import {
  YieldFlowReviewVisit,
  yieldFlowReviewPage,
} from "../state/review-page";

export const {
  context: YieldFlowSessionContext,
  useValue: useYieldFlowSession,
} = makeTransactionFlowContext<YieldFlowSession>("Yield Flow Session");

/**
 * A deposit's intake, which only an Enter flow's routes provide, so a layout
 * around them can describe it.
 */
export const {
  context: YieldFlowEnterIntakeContext,
  useValue: useYieldFlowEnterIntake,
} = makeTransactionFlowContext<EnterYieldTransactionFlowIntake>(
  "Yield Flow Enter intake"
);

/** The Execution Steps and Complete show, which their route provides. */
export const {
  context: YieldFlowExecutionContext,
  useValue: useProvidedYieldFlowExecution,
} = makeTransactionFlowContext<YieldFlowExecutionPage>("Yield Flow Execution");

/** This visit's Review: the same Atoms for every render of it. */
export const useYieldFlowReview = () =>
  useAtomValue(
    yieldFlowReviewPage(
      new YieldFlowReviewVisit({
        session: useYieldFlowSession(),
        visit: useLocation().key,
      })
    )
  );

/** The handoff Steps and Complete were navigated to run, if any. */
export const useYieldFlowExecutionHandoff = () => {
  const session = useYieldFlowSession();
  return (
    useWidgetRouteState(yieldFlowRoutes[session.mount._tag])
      ?.executionHandoff ?? null
  );
};

/**
 * The Execution of the handoff Steps and Complete were navigated to run;
 * null without one.
 */
export const useNavigatedYieldFlowExecution =
  (): YieldFlowExecutionPage | null => {
    const handoff = useYieldFlowExecutionHandoff();
    const session = useYieldFlowSession();
    return useOptionalAtomValue(
      yieldFlowExecutionPage,
      handoff === null ? null : new YieldFlowExecutionKey({ handoff, session })
    );
  };
