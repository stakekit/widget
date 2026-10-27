import { Match } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Route } from "react-router";
import {
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowRoute,
} from "../react/yield-flow-route";
import { PendingCompletePage } from "./complete/pages/pending-complete.page.tsx";
import { StakeCompletePage } from "./complete/pages/stake-complete.page.tsx";
import { UnstakeCompletePage } from "./complete/pages/unstake-complete.page.tsx";
import { PendingReviewPage } from "./review/pages/pending-review.page.tsx";
import { StakeReviewPage } from "./review/pages/stake-review.page.tsx";
import { UnstakeReviewPage } from "./review/pages/unstake-review.page.tsx";
import { PendingStepsPage } from "./steps/pages/pending-steps.page.tsx";
import { StakeStepsPage } from "./steps/pages/stake-steps.page.tsx";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page.tsx";

type YieldFlowRouteMount = {
  readonly journey: "Enter" | "Exit" | "Manage";
  /**
   * Layout rendered inside the Session (it may read the Session intake) around
   * Review, Steps, and Complete; it renders their `<Outlet />`.
   */
  readonly layout?: ReactNode;
};

type StandardYieldFlowPages = Readonly<{
  CompletePage: ComponentType;
  ReviewPage: ComponentType;
  StepsPage: ComponentType;
}>;

const createStandardYieldFlowRoutes = (
  { journey, layout }: YieldFlowRouteMount,
  { CompletePage, ReviewPage, StepsPage }: StandardYieldFlowPages
) => {
  const pages = (
    <>
      <Route path="review" element={<ReviewPage />} />
      <Route element={<YieldFlowExecutionRoute />}>
        <Route
          path="steps"
          element={
            <YieldFlowExecutionPage page="Steps">
              <StepsPage />
            </YieldFlowExecutionPage>
          }
        />
        <Route
          path="complete"
          element={
            <YieldFlowExecutionPage page="Complete">
              <CompletePage />
            </YieldFlowExecutionPage>
          }
        />
      </Route>
    </>
  );

  return (
    <Route element={<YieldFlowRoute expected={journey} />}>
      {layout ? <Route element={layout}>{pages}</Route> : pages}
    </Route>
  );
};

export const createYieldFlowRoutes = (mount: YieldFlowRouteMount) =>
  Match.value(mount.journey).pipe(
    Match.when("Enter", () =>
      createStandardYieldFlowRoutes(mount, {
        CompletePage: StakeCompletePage,
        ReviewPage: StakeReviewPage,
        StepsPage: StakeStepsPage,
      })
    ),
    Match.when("Exit", () =>
      createStandardYieldFlowRoutes(mount, {
        CompletePage: UnstakeCompletePage,
        ReviewPage: UnstakeReviewPage,
        StepsPage: UnstakeStepsPage,
      })
    ),
    Match.when("Manage", () =>
      createStandardYieldFlowRoutes(mount, {
        CompletePage: PendingCompletePage,
        ReviewPage: PendingReviewPage,
        StepsPage: PendingStepsPage,
      })
    ),
    Match.exhaustive
  );
