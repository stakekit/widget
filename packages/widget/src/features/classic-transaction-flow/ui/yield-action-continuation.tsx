import type { PropsWithChildren } from "react";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  ClassicFlowRoute,
  useClassicFlowIntake,
} from "../react/classic-flow-route";
import { ActivityCompletePage } from "./complete/pages/activity-complete.page";
import { PendingStepsPage } from "./steps/pages/pending-steps.page";
import { StakeStepsPage } from "./steps/pages/stake-steps.page";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page";

export const YieldActionContinuationSessionRoute = () => (
  <ClassicFlowRoute expected="YieldActionContinuation" />
);

export const YieldActionContinuationReviewScope = ({
  children,
}: PropsWithChildren) => (
  <ClassicFlowReviewScope>{children}</ClassicFlowReviewScope>
);

export const YieldActionContinuationExecutionScope = () => (
  <ClassicFlowExecutionScope />
);

export const YieldActionContinuationStepsPage = () => {
  const { action } = useClassicFlowIntake("YieldActionContinuation");

  switch (action.intent) {
    case "enter":
      return <StakeStepsPage />;
    case "exit":
      return <UnstakeStepsPage />;
    case "manage":
      return <PendingStepsPage />;
  }
};

export const YieldActionContinuationCompletePage = ActivityCompletePage;
