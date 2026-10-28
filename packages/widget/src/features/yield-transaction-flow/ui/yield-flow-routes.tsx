import { Match } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Route } from "react-router";
import { widgetYieldFlowRoutes } from "../../../services/navigation/widget-routes";
import type { YieldFlowMountTag } from "../model/yield-transaction-flow";
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
  readonly mount: Exclude<YieldFlowMountTag, "YieldActionContinuation">;
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
  { layout, mount }: YieldFlowRouteMount,
  journey: "Enter" | "Exit" | "Manage",
  { CompletePage, ReviewPage, StepsPage }: StandardYieldFlowPages
) => {
  const routes = widgetYieldFlowRoutes[mount];
  const pages = (
    <>
      <Route path={routes.review.pattern} element={<ReviewPage />} />
      <Route element={<YieldFlowExecutionRoute />}>
        <Route
          path={routes.steps.pattern}
          element={
            <YieldFlowExecutionPage page="Steps">
              <StepsPage />
            </YieldFlowExecutionPage>
          }
        />
        <Route
          path={routes.complete.pattern}
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
    <Route element={<YieldFlowRoute expected={journey} mount={mount} />}>
      {layout ? <Route element={layout}>{pages}</Route> : pages}
    </Route>
  );
};

/** Review, Steps, and Complete of the Yield Transaction Flow `mount` starts. */
export const createYieldFlowRoutes = (route: YieldFlowRouteMount) =>
  Match.value(route.mount).pipe(
    Match.whenOr("Earn", "PositionStake", () =>
      createStandardYieldFlowRoutes(route, "Enter", {
        CompletePage: StakeCompletePage,
        ReviewPage: StakeReviewPage,
        StepsPage: StakeStepsPage,
      })
    ),
    Match.when("PositionExit", () =>
      createStandardYieldFlowRoutes(route, "Exit", {
        CompletePage: UnstakeCompletePage,
        ReviewPage: UnstakeReviewPage,
        StepsPage: UnstakeStepsPage,
      })
    ),
    Match.when("PositionManage", () =>
      createStandardYieldFlowRoutes(route, "Manage", {
        CompletePage: PendingCompletePage,
        ReviewPage: PendingReviewPage,
        StepsPage: PendingStepsPage,
      })
    ),
    Match.exhaustive
  );
