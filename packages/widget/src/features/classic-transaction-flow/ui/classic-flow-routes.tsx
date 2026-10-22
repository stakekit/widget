import { Match } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Route } from "react-router";
import {
  ClassicFlowExecutionPage,
  ClassicFlowExecutionRoute,
  ClassicFlowRoute,
} from "../react/classic-flow-route";
import { PendingCompletePage } from "./complete/pages/pending-complete.page.tsx";
import { StakeCompletePage } from "./complete/pages/stake-complete.page.tsx";
import { UnstakeCompletePage } from "./complete/pages/unstake-complete.page.tsx";
import { PendingReviewPage } from "./review/pages/pending-review.page.tsx";
import { StakeReviewPage } from "./review/pages/stake-review.page.tsx";
import { UnstakeReviewPage } from "./review/pages/unstake-review.page.tsx";
import { PendingStepsPage } from "./steps/pages/pending-steps.page.tsx";
import { StakeStepsPage } from "./steps/pages/stake-steps.page.tsx";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page.tsx";

type ClassicFlowRouteMount = {
  readonly journey: "Enter" | "Exit" | "Manage";
  /**
   * Layout rendered inside the Session (it may read the Session intake) around
   * Review, Steps, and Complete; it renders their `<Outlet />`.
   */
  readonly layout?: ReactNode;
};

type StandardClassicFlowPages = Readonly<{
  CompletePage: ComponentType;
  ReviewPage: ComponentType;
  StepsPage: ComponentType;
}>;

const createStandardClassicFlowRoutes = (
  { journey, layout }: ClassicFlowRouteMount,
  { CompletePage, ReviewPage, StepsPage }: StandardClassicFlowPages
) => {
  const pages = (
    <>
      <Route path="review" element={<ReviewPage />} />
      <Route element={<ClassicFlowExecutionRoute />}>
        <Route
          path="steps"
          element={
            <ClassicFlowExecutionPage page="Steps">
              <StepsPage />
            </ClassicFlowExecutionPage>
          }
        />
        <Route
          path="complete"
          element={
            <ClassicFlowExecutionPage page="Complete">
              <CompletePage />
            </ClassicFlowExecutionPage>
          }
        />
      </Route>
    </>
  );

  return (
    <Route element={<ClassicFlowRoute expected={journey} />}>
      {layout ? <Route element={layout}>{pages}</Route> : pages}
    </Route>
  );
};

export const createClassicFlowRoutes = (mount: ClassicFlowRouteMount) =>
  Match.value(mount.journey).pipe(
    Match.when("Enter", () =>
      createStandardClassicFlowRoutes(mount, {
        CompletePage: StakeCompletePage,
        ReviewPage: StakeReviewPage,
        StepsPage: StakeStepsPage,
      })
    ),
    Match.when("Exit", () =>
      createStandardClassicFlowRoutes(mount, {
        CompletePage: UnstakeCompletePage,
        ReviewPage: UnstakeReviewPage,
        StepsPage: UnstakeStepsPage,
      })
    ),
    Match.when("Manage", () =>
      createStandardClassicFlowRoutes(mount, {
        CompletePage: PendingCompletePage,
        ReviewPage: PendingReviewPage,
        StepsPage: PendingStepsPage,
      })
    ),
    Match.exhaustive
  );
