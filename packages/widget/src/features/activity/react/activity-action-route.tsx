import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { createContext, useContext } from "react";
import { Navigate, Outlet, useMatch, useParams } from "react-router";
import { ContentLoaderSquare } from "../../../shared/ui/primitives/content-loader";
import { YieldActionContinuationSessionRoute } from "../../classic-transaction-flow/views";
import { walletScopeAtom } from "../../wallet/index";
import type { YieldSummaryProvider } from "../../yield-summary/index";
import type { ActivityActionItem } from "../model/activity-action";
import {
  ActivitySelectionKey,
  activityActionContinuationMountAtom,
  activityDetailsViewAtom,
  parseActivityRouteIntent,
  resolveUnavailableActivitySelection,
  retryActivityActionRouteAtom,
} from "../state/details";
import {
  ActivityDetailsFailure,
  ActivityDetailsUnavailable,
} from "../ui/activity-details/activity-details-status";

export type ActivityPresentation = "Classic" | "Dashboard";

type ActivityActionRouteValue = Readonly<{
  readonly continuationReady: boolean;
  readonly item: ActivityActionItem;
  readonly presentation: ActivityPresentation;
  readonly providersDetails: ReadonlyArray<YieldSummaryProvider>;
}>;

const ActivityActionRouteContext =
  createContext<ActivityActionRouteValue | null>(null);

export const useActivityActionRoute = (): ActivityActionRouteValue => {
  const value = useContext(ActivityActionRouteContext);
  if (!value) throw new Error("Activity Action route is unavailable.");
  return value;
};

export const ActivityActionRoute = ({
  presentation,
}: {
  readonly presentation: ActivityPresentation;
}) => {
  const { actionId: actionIdParam } = useParams();
  const stepsMatch = useMatch("/activity/:actionId/steps");
  const completeMatch = useMatch("/activity/:actionId/complete");
  const executionMatch = stepsMatch ?? completeMatch;
  const scope = useAtomValue(walletScopeAtom);
  const parsed = parseActivityRouteIntent({
    actionIdParam,
    allowDefault: presentation === "Dashboard",
  });

  if (!scope) return <ActivityDetailsUnavailable />;
  if (parsed.status === "missing" || parsed.status === "invalid") {
    return <Navigate replace to="/activity" />;
  }

  return (
    <BoundActivityActionRoute
      presentation={presentation}
      selectionKey={
        new ActivitySelectionKey({
          intent: parsed.intent,
          scope,
          surface: executionMatch ? "execution" : "review",
        })
      }
    />
  );
};

const BoundActivityActionRoute = ({
  presentation,
  selectionKey,
}: {
  readonly presentation: ActivityPresentation;
  readonly selectionKey: ActivitySelectionKey;
}) => {
  useAtomMount(activityActionContinuationMountAtom(selectionKey));
  const result = useAtomValue(activityDetailsViewAtom(selectionKey));
  const retry = useAtomSet(retryActivityActionRouteAtom(selectionKey));

  if (result.status === "loading") {
    return <ContentLoaderSquare heightPx={320} />;
  }
  if (result.status === "failed") {
    return <ActivityDetailsFailure onRetry={() => retry(undefined)} />;
  }
  if (result.status === "unavailable") {
    return resolveUnavailableActivitySelection(selectionKey.intent) ===
      "clear-route" ? (
      <Navigate replace to="/activity" />
    ) : null;
  }

  const reviewPath = `/activity/${encodeURIComponent(result.item.actionData.id)}`;
  if (selectionKey.surface === "execution" && !result.continuationReady) {
    return <Navigate replace to={reviewPath} />;
  }

  return (
    <ActivityActionRouteContext.Provider
      value={{
        continuationReady: result.continuationReady,
        item: result.item,
        presentation,
        providersDetails: result.providersDetails,
      }}
    >
      {result.continuationReady ? (
        <YieldActionContinuationSessionRoute />
      ) : (
        <Outlet />
      )}
    </ActivityActionRouteContext.Provider>
  );
};
