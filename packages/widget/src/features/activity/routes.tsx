import type { ComponentType } from "react";
import { Route } from "react-router";
import {
  YieldActionContinuationCompletePage,
  YieldActionContinuationExecutionScope,
  YieldActionContinuationStepsPage,
} from "../classic-transaction-flow/views";
import {
  ActivityActionRoute,
  type ActivityPresentation,
} from "./react/activity-action-route";
import { ActivityDetailsPage } from "./ui/activity-details/activity-details.page";

const activityActionChildRoutes = (
  <>
    <Route index element={<ActivityDetailsPage />} />
    <Route element={<YieldActionContinuationExecutionScope />}>
      <Route path="steps" element={<YieldActionContinuationStepsPage />} />
      <Route
        path="complete"
        element={<YieldActionContinuationCompletePage />}
      />
    </Route>
  </>
);

export const createActivityActionRoutes = (
  presentation: ActivityPresentation,
  options?: {
    readonly ActionScopeGuard?: ComponentType<{
      readonly fallbackPath: string;
    }>;
  }
) => {
  const ActionScopeGuard = options?.ActionScopeGuard;
  const actionIdRoute = (
    <Route
      path=":actionId"
      element={<ActivityActionRoute presentation={presentation} />}
    >
      {activityActionChildRoutes}
    </Route>
  );

  return (
    <>
      {presentation === "Dashboard" ? (
        <Route element={<ActivityActionRoute presentation={presentation} />}>
          <Route index element={<ActivityDetailsPage />} />
        </Route>
      ) : null}
      {ActionScopeGuard ? (
        <Route element={<ActionScopeGuard fallbackPath="/activity" />}>
          {actionIdRoute}
        </Route>
      ) : (
        actionIdRoute
      )}
    </>
  );
};
