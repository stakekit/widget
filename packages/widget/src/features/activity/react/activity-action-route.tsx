import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createContext, useContext, useState } from "react";
import { Navigate, Outlet, useMatch, useParams } from "react-router";
import type { ActionId } from "../../../domain/identity/identifiers";
import { ContentLoaderSquare } from "../../../shared/ui/primitives/content-loader";
import { YieldActionContinuationSessionRoute } from "../../classic-transaction-flow/views";
import { walletScopeAtom } from "../../wallet/index";
import type { YieldSummaryProvider } from "../../yield-summary/index";
import type { ActivityActionItem } from "../model/activity-action";
import {
  ActivitySelectionKey,
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
  const result = useAtomValue(activityDetailsViewAtom(selectionKey));
  const retry = useAtomSet(retryActivityActionRouteAtom(selectionKey));
  // The action whose Continuation this route mounted from its Review. Its
  // Session lives in this subtree across Review, Steps, and Complete.
  const [continuedActionId, setContinuedActionId] = useState<ActionId | null>(
    null
  );

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

  const { item } = result;
  const action = item.actionData;
  const reviewPath = `/activity/${encodeURIComponent(action.id)}`;
  // Only the explicit action route spans Review, Steps, and Complete, so it is
  // the one that owns a continuation.
  if (result.canContinue && selectionKey.intent._tag === "default") {
    return <Navigate replace to={reviewPath} />;
  }
  // A continuation started on this action's Review stays mounted through its
  // execution; any other action drops it.
  const nextContinuedActionId =
    result.canContinue || continuedActionId === action.id ? action.id : null;
  if (nextContinuedActionId !== continuedActionId) {
    setContinuedActionId(nextContinuedActionId);
    return null;
  }
  const continuationReady = continuedActionId === action.id;
  if (selectionKey.surface === "execution" && !continuationReady) {
    return <Navigate replace to={reviewPath} />;
  }

  return (
    <ActivityActionRouteContext.Provider
      value={{
        continuationReady,
        item,
        presentation,
        providersDetails: result.providersDetails,
      }}
    >
      {continuationReady && item.yieldData ? (
        <YieldActionContinuationSessionRoute
          key={action.id}
          continuation={{
            action,
            providersDetails: result.providersDetails,
            selectedValidators: item.validatorsData,
            selectedYield: item.yieldData,
            walletScope: item.walletScope,
          }}
        />
      ) : (
        <Outlet />
      )}
    </ActivityActionRouteContext.Provider>
  );
};
