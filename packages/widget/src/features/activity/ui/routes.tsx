import type { ComponentType } from "react";
import { Route } from "react-router";

import {
  type WidgetPath,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../services/navigation/widget-routes";
import {
  YieldActionContinuationCompletePage,
  YieldActionContinuationExecution,
  YieldActionContinuationStepsPage,
} from "../../yield-transaction-flow/views";
import {
  ActivityActionRoute,
  type ActivityReceiptPlacement,
} from "./activity-action-route";
import { ActivityDetailsPage } from "./activity-details/activity-details.page";

const continuationRoutes = widgetYieldFlowRoutes.YieldActionContinuation;

const activityActionChildRoutes = (
  <>
    <Route index element={<ActivityDetailsPage />} />
    <Route element={<YieldActionContinuationExecution />}>
      <Route
        path={continuationRoutes.steps.pattern}
        element={<YieldActionContinuationStepsPage />}
      />
      <Route
        path={continuationRoutes.complete.pattern}
        element={<YieldActionContinuationCompletePage />}
      />
    </Route>
  </>
);

export const createActivityActionRoutes = ({
  ActionScopeGuard,
  receiptPlacement,
  selectsDefaultAction,
}: {
  readonly ActionScopeGuard?: ComponentType<{
    readonly fallbackPath: WidgetPath;
  }>;
  /** Where the action details draw their receipt. */
  readonly receiptPlacement: ActivityReceiptPlacement;
  /** Whether the bare Activity route selects a default action. */
  readonly selectsDefaultAction: boolean;
}) => {
  const actionRoute = (source: "borrow" | "yield") => (
    <ActivityActionRoute
      receiptPlacement={receiptPlacement}
      selectsDefaultAction={selectsDefaultAction}
      source={source}
    />
  );
  const actionIdRoutes = (
    <>
      <Route
        path={widgetRoutes.activityBorrowAction.pattern}
        element={actionRoute("borrow")}
      >
        <Route index element={<ActivityDetailsPage />} />
      </Route>
      <Route
        path={continuationRoutes.review.pattern}
        element={actionRoute("yield")}
      >
        {activityActionChildRoutes}
      </Route>
    </>
  );

  return (
    <>
      {selectsDefaultAction ? (
        <Route element={actionRoute("yield")}>
          <Route index element={<ActivityDetailsPage />} />
        </Route>
      ) : null}
      {ActionScopeGuard ? (
        <Route
          element={
            <ActionScopeGuard fallbackPath={widgetRoutes.activity.build()} />
          }
        >
          {actionIdRoutes}
        </Route>
      ) : (
        actionIdRoutes
      )}
    </>
  );
};
