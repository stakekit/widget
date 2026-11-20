import { useState } from "react";

import type { TransactionFlowTrail } from "../../transaction-flow/index";
import { makeYieldActionContinuationSession } from "../model/session";
import { YieldFlowCompletePage } from "./complete/pages/yield-flow-complete.page";
import { StepsPage } from "./steps/pages/common.page";
import {
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowSessionRoute,
} from "./yield-flow-route";

type YieldActionContinuationInput = Omit<
  Parameters<typeof makeYieldActionContinuationSession>[0],
  "_tag"
>;

/**
 * Owns one Yield Action Continuation Session for as long as it stays mounted,
 * built from the input it first mounted with. Activity remounts it (by key)
 * for another action. `trail`, when the composition gives one, puts a
 * breadcrumb with a back button on Steps and Complete.
 */
export const YieldActionContinuationSessionRoute = ({
  continuation,
  trail,
}: {
  readonly continuation: YieldActionContinuationInput;
  readonly trail: TransactionFlowTrail | null;
}) => {
  const [session] = useState(() =>
    makeYieldActionContinuationSession({
      _tag: "YieldActionContinuation",
      ...continuation,
    })
  );
  return <YieldFlowSessionRoute session={session} trail={trail} />;
};

/** The continuation's Steps and Complete, which share one Execution. */
export const YieldActionContinuationExecution = () => (
  <YieldFlowExecutionRoute />
);

export const YieldActionContinuationStepsPage = () => (
  <YieldFlowExecutionPage page="Steps">
    <StepsPage />
  </YieldFlowExecutionPage>
);

export const YieldActionContinuationCompletePage = () => (
  <YieldFlowExecutionPage page="Complete">
    <YieldFlowCompletePage />
  </YieldFlowExecutionPage>
);
