import { useState } from "react";
import { makeYieldActionContinuationSession } from "../model/yield-transaction-flow";
import {
  useYieldFlowIntake,
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowSessionRoute,
} from "../react/yield-flow-route";
import { ActivityCompletePage } from "./complete/pages/activity-complete.page";
import { EnterStepsPage } from "./steps/pages/enter-steps.page";
import { ExitStepsPage } from "./steps/pages/exit-steps.page";
import { PendingStepsPage } from "./steps/pages/pending-steps.page";

type YieldActionContinuationInput = Omit<
  Parameters<typeof makeYieldActionContinuationSession>[0],
  "_tag"
>;

/**
 * Owns one Yield Action Continuation Session for as long as it stays mounted,
 * built from the input it first mounted with. Activity remounts it (by key)
 * for another action.
 */
export const YieldActionContinuationSessionRoute = ({
  continuation,
}: {
  readonly continuation: YieldActionContinuationInput;
}) => {
  const [session] = useState(() =>
    makeYieldActionContinuationSession({
      _tag: "YieldActionContinuation",
      ...continuation,
    })
  );
  return <YieldFlowSessionRoute session={session} />;
};

/** The continuation's Steps and Complete, which share one Execution. */
export const YieldActionContinuationExecution = () => (
  <YieldFlowExecutionRoute />
);

const ContinuationStepsPage = () => {
  const { action } = useYieldFlowIntake("YieldActionContinuation");

  switch (action.intent) {
    case "enter":
      return <EnterStepsPage />;
    case "exit":
      return <ExitStepsPage />;
    case "manage":
      return <PendingStepsPage />;
  }
};

export const YieldActionContinuationStepsPage = () => (
  <YieldFlowExecutionPage page="Steps">
    <ContinuationStepsPage />
  </YieldFlowExecutionPage>
);

export const YieldActionContinuationCompletePage = () => (
  <YieldFlowExecutionPage page="Complete">
    <ActivityCompletePage />
  </YieldFlowExecutionPage>
);
