import { useAtomValue } from "@effect/atom-react";
import { createContext, useContext } from "react";
import { useLocation } from "react-router";

import { useWidgetRouteState } from "../../navigation/index";
import {
  getYieldTransactionFlowIntakeVariant,
  type YieldTransactionFlowIntake,
} from "../model/intake";
import { type YieldFlowSession, yieldFlowRoutes } from "../model/session";
import {
  YieldFlowExecutionKey,
  yieldFlowExecutionPage,
} from "../state/execution-page";
import {
  YieldFlowReviewVisit,
  yieldFlowReviewPage,
} from "../state/review-page";

export const YieldFlowSessionContext = createContext<YieldFlowSession | null>(
  null
);

export const useYieldFlowSession = (): YieldFlowSession => {
  const session = useContext(YieldFlowSessionContext);
  if (!session) throw new Error("Yield Flow Session is unavailable.");
  return session;
};

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

/** The Execution of the handoff Steps and Complete were navigated to run. */
export const useYieldFlowExecution = () => {
  const handoff = useYieldFlowExecutionHandoff();
  const session = useYieldFlowSession();
  if (!handoff) throw new Error("Yield Flow Execution is unavailable.");
  return useAtomValue(
    yieldFlowExecutionPage(new YieldFlowExecutionKey({ handoff, session }))
  );
};

export const useYieldFlowIntake = <
  Variant extends YieldTransactionFlowIntake["_tag"],
>(
  variant: Variant
): Extract<YieldTransactionFlowIntake, { readonly _tag: Variant }> => {
  const intake = getYieldTransactionFlowIntakeVariant(
    useYieldFlowSession().intake,
    variant
  );
  if (!intake) throw new Error(`Expected Yield Flow ${variant} intake.`);
  return intake;
};
