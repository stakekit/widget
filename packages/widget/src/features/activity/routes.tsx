import type { ComponentType } from "react";
import { Route } from "react-router";
import {
  YieldActionContinuationCompletePage,
  YieldActionContinuationExecution,
  YieldActionContinuationStepsPage,
} from "../yield-transaction-flow/views";
import {
  ActivityActionRoute,
  type ActivityPresentation,
} from "./react/activity-action-route";
import { ActivityDetailsPage } from "./ui/activity-details/activity-details.page";

const activityActionChildRoutes = (
  <>
    <Route index element={<ActivityDetailsPage />} />
    <Route element={<YieldActionContinuationExecution />}>
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
  const actionIdRoutes = (
    <>
      <Route
        path="borrow/:actionId"
        element={
          <ActivityActionRoute presentation={presentation} source="borrow" />
        }
      >
        <Route index element={<ActivityDetailsPage />} />
      </Route>
      <Route
        path=":actionId"
        element={
          <ActivityActionRoute presentation={presentation} source="yield" />
        }
      >
        {activityActionChildRoutes}
      </Route>
    </>
  );

  return (
    <>
      {presentation === "Dashboard" ? (
        <Route
          element={
            <ActivityActionRoute presentation={presentation} source="yield" />
          }
        >
          <Route index element={<ActivityDetailsPage />} />
        </Route>
      ) : null}
      {ActionScopeGuard ? (
        <Route element={<ActionScopeGuard fallbackPath="/activity" />}>
          {actionIdRoutes}
        </Route>
      ) : (
        actionIdRoutes
      )}
    </>
  );
};
