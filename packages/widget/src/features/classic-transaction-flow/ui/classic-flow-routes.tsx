import { Match } from "effect";
import type { ComponentType } from "react";
import { Route } from "react-router";
import { historicalActivityCompletePaths } from "../react/activity-route-paths";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  ClassicFlowRoute,
} from "../react/classic-flow-route";
import { ActivityDetailsPage } from "./activity-details.page.tsx";
import { ActivityCompletePage } from "./complete/pages/activity-complete.page.tsx";
import { PendingCompletePage } from "./complete/pages/pending-complete.page.tsx";
import { StakeCompletePage } from "./complete/pages/stake-complete.page.tsx";
import { UnstakeCompletePage } from "./complete/pages/unstake-complete.page.tsx";
import { ActionReviewPage } from "./review/pages/action-review.page.tsx";
import { PendingReviewPage } from "./review/pages/pending-review.page.tsx";
import { StakeReviewPage } from "./review/pages/stake-review.page.tsx";
import { UnstakeReviewPage } from "./review/pages/unstake-review.page.tsx";
import { ActivityStepsPage } from "./steps/pages/activity-steps.page.tsx";
import { PendingStepsPage } from "./steps/pages/pending-steps.page.tsx";
import { StakeStepsPage } from "./steps/pages/stake-steps.page.tsx";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page.tsx";

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
    {Object.values(historicalActivityCompletePaths).map((path) => (
      <Route key={path} path={path} element={<ActivityDetailsPage />} />
    ))}
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
      <Route
        path=":pendingActionType/complete"
        element={<ActivityCompletePage />}
      />
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
