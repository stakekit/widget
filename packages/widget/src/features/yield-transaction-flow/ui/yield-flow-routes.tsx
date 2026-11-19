import type { ReactNode } from "react";
import { Route } from "react-router";

import { widgetYieldFlowRoutes } from "../../../services/navigation/widget-routes";
import type { TransactionFlowTrail } from "../../transaction-flow/index";
import type { YieldPreviewIntake } from "../model/intake";
import type { YieldFlowMountTag } from "../model/session";
import { YieldFlowCompletePage } from "./complete/pages/yield-flow-complete.page.tsx";
import { YieldFlowReviewPage } from "./review/pages/yield-flow-review.page.tsx";
import { StepsPage } from "./steps/pages/common.page.tsx";
import {
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowRoute,
} from "./yield-flow-route";

type YieldFlowRouteMount = {
  readonly mount: Exclude<YieldFlowMountTag, "YieldActionContinuation">;
  /**
   * Layout rendered inside the Session (it may read the Session intake) around
   * Review, Steps, and Complete; it renders their `<Outlet />`.
   */
  readonly layout?: ReactNode;
  /**
   * Where the flow sits, for the breadcrumb and back button its pages show;
   * without one, the page around the flow or the shell offers back.
   */
  readonly trail?: TransactionFlowTrail | null;
};

const journeys = {
  Earn: "Enter",
  PositionExit: "Exit",
  PositionManage: "Manage",
  PositionStake: "Enter",
} as const satisfies Record<
  YieldFlowRouteMount["mount"],
  YieldPreviewIntake["_tag"]
>;

/** Review, Steps, and Complete of the Yield Transaction Flow `mount` starts. */
export const createYieldFlowRoutes = ({
  layout,
  mount,
  trail = null,
}: YieldFlowRouteMount) => {
  const routes = widgetYieldFlowRoutes[mount];
  const pages = (
    <>
      <Route path={routes.review.pattern} element={<YieldFlowReviewPage />} />
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
              <YieldFlowCompletePage />
            </YieldFlowExecutionPage>
          }
        />
      </Route>
    </>
  );

  return (
    <Route
      element={
        <YieldFlowRoute
          expected={journeys[mount]}
          mount={mount}
          trail={trail}
        />
      }
    >
      {layout ? <Route element={layout}>{pages}</Route> : pages}
    </Route>
  );
};
