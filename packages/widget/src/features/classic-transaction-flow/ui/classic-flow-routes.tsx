import { Match } from "effect";
import type { ComponentType } from "react";
import { Route } from "react-router";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  ClassicFlowRoute,
} from "../react/classic-flow-route";
import { ActivityDetailsPage } from "./activity-details.page";
import { ActivityCompletePage } from "./complete/pages/activity-complete.page";
import { PendingCompletePage } from "./complete/pages/pending-complete.page";
import { StakeCompletePage } from "./complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "./complete/pages/unstake-complete.page";
import { ActionReviewPage } from "./review/pages/action-review.page";
import { PendingReviewPage } from "./review/pages/pending-review.page";
import { StakeReviewPage } from "./review/pages/stake-review.page";
import { UnstakeReviewPage } from "./review/pages/unstake-review.page";
import { ActivityStepsPage } from "./steps/pages/activity-steps.page";
import { PendingStepsPage } from "./steps/pages/pending-steps.page";
import { StakeStepsPage } from "./steps/pages/stake-steps.page";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page";

type ClassicFlowRouteMount =
  | {
      readonly journey: "Enter" | "Exit" | "Manage";
    }
  | {
      readonly journey: "ActivityResume";
      readonly presentation: "Classic" | "Dashboard";
    };

type StandardClassicFlowJourney = "Enter" | "Exit" | "Manage";

type StandardClassicFlowPages = Readonly<{
  CompletePage: ComponentType;
  ReviewPage: ComponentType;
  StepsPage: ComponentType;
}>;

const createStandardClassicFlowRoutes = (
  journey: StandardClassicFlowJourney,
  { CompletePage, ReviewPage, StepsPage }: StandardClassicFlowPages
) => (
  <Route element={<ClassicFlowRoute expected={journey} />}>
    <Route
      path="review"
      element={
        <ClassicFlowReviewScope>
          <ReviewPage />
        </ClassicFlowReviewScope>
      }
    />
    <Route element={<ClassicFlowExecutionScope />}>
      <Route path="steps" element={<StepsPage />} />
      <Route path="complete" element={<CompletePage />} />
    </Route>
  </Route>
);

const createClassicActivityResumeRoutes = () => (
  <Route element={<ClassicFlowRoute expected="ActivityResume" />}>
    <Route
      path="review"
      element={
        <ClassicFlowReviewScope>
          <ActionReviewPage />
        </ClassicFlowReviewScope>
      }
    />
    <Route element={<ClassicFlowExecutionScope />}>
      <Route path=":pendingActionType/steps" element={<ActivityStepsPage />} />
      <Route
        path=":pendingActionType/complete"
        element={<ActivityCompletePage />}
      />
    </Route>
  </Route>
);

const createDashboardActivityResumeRoutes = () => (
  <Route element={<ClassicFlowRoute expected="ActivityResume" />}>
    <Route index element={<ActivityDetailsPage />} />
    <Route element={<ClassicFlowExecutionScope />}>
      <Route path=":pendingActionType/steps" element={<ActivityStepsPage />} />
    </Route>
  </Route>
);

export const createClassicFlowRoutes = (mount: ClassicFlowRouteMount) =>
  Match.value(mount).pipe(
    Match.when({ journey: "Enter" }, () =>
      createStandardClassicFlowRoutes("Enter", {
        CompletePage: StakeCompletePage,
        ReviewPage: StakeReviewPage,
        StepsPage: StakeStepsPage,
      })
    ),
    Match.when({ journey: "Exit" }, () =>
      createStandardClassicFlowRoutes("Exit", {
        CompletePage: UnstakeCompletePage,
        ReviewPage: UnstakeReviewPage,
        StepsPage: UnstakeStepsPage,
      })
    ),
    Match.when({ journey: "Manage" }, () =>
      createStandardClassicFlowRoutes("Manage", {
        CompletePage: PendingCompletePage,
        ReviewPage: PendingReviewPage,
        StepsPage: PendingStepsPage,
      })
    ),
    Match.when(
      { journey: "ActivityResume", presentation: "Classic" },
      createClassicActivityResumeRoutes
    ),
    Match.when(
      { journey: "ActivityResume", presentation: "Dashboard" },
      createDashboardActivityResumeRoutes
    ),
    Match.exhaustive
  );
