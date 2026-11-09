import { Match } from "effect";
import type { ComponentType, ReactNode } from "react";
import { Route } from "react-router";
import { widgetYieldFlowRoutes } from "../../../services/navigation/widget-routes";
import type { YieldFlowMountTag } from "../model/session";
import {
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowRoute,
} from "../react/yield-flow-route";
import { EnterCompletePage } from "./complete/pages/enter-complete.page.tsx";
import { ExitCompletePage } from "./complete/pages/exit-complete.page.tsx";
import { PendingCompletePage } from "./complete/pages/pending-complete.page.tsx";
import { EnterReviewPage } from "./review/pages/enter-review.page.tsx";
import { ExitReviewPage } from "./review/pages/exit-review.page.tsx";
import { PendingReviewPage } from "./review/pages/pending-review.page.tsx";
import { EnterStepsPage } from "./steps/pages/enter-steps.page.tsx";
import { ExitStepsPage } from "./steps/pages/exit-steps.page.tsx";
import { PendingStepsPage } from "./steps/pages/pending-steps.page.tsx";

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
        CompletePage: EnterCompletePage,
        ReviewPage: EnterReviewPage,
        StepsPage: EnterStepsPage,
      })
    ),
    Match.when("PositionExit", () =>
      createStandardYieldFlowRoutes(route, "Exit", {
        CompletePage: ExitCompletePage,
        ReviewPage: ExitReviewPage,
        StepsPage: ExitStepsPage,
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
