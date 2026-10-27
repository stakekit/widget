import type { ComponentType } from "react";
import { Route } from "react-router";
import {
  YieldActionContinuationCompletePage,
  YieldActionContinuationExecution,
  YieldActionContinuationStepsPage,
} from "../yield-transaction-flow/views";
import { ActivityActionRoute } from "./react/activity-action-route";
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

export const createActivityActionRoutes = ({
  ActionScopeGuard,
  selectsDefaultAction,
  showsBackButton,
}: {
  readonly ActionScopeGuard?: ComponentType<{
    readonly fallbackPath: string;
  }>;
  /** Whether the bare Activity route selects a default action. */
  readonly selectsDefaultAction: boolean;
  /** Whether the action details render a back button to the Activity list. */
  readonly showsBackButton: boolean;
}) => {
  const actionRoute = (source: "borrow" | "yield") => (
    <ActivityActionRoute
      selectsDefaultAction={selectsDefaultAction}
      showsBackButton={showsBackButton}
      source={source}
    />
  );
  const actionIdRoutes = (
    <>
      <Route path="borrow/:actionId" element={actionRoute("borrow")}>
        <Route index element={<ActivityDetailsPage />} />
      </Route>
      <Route path=":actionId" element={actionRoute("yield")}>
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
        <Route element={<ActionScopeGuard fallbackPath="/activity" />}>
          {actionIdRoutes}
        </Route>
      ) : (
        actionIdRoutes
      )}
    </>
  );
};
