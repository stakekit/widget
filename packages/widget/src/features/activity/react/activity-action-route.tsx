import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router";
import {
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../services/navigation/widget-routes";
import { ContentLoaderSquare } from "../../../shared/ui/primitives/content-loader";
import {
  useWidgetRouteMatch,
  useWidgetRoutePrefixMatch,
} from "../../navigation/index";
import { WidgetNavigate } from "../../navigation/views";
import { walletScopeAtom } from "../../wallet/index";
import type { YieldSummaryProvider } from "../../yield-summary/index";
import { YieldActionContinuationSessionRoute } from "../../yield-transaction-flow/views";
import {
  type ActivityActionItem,
  type ActivitySelectionTarget,
  getActivityActionPath,
  getActivitySelectionTarget,
} from "../model/activity-action";
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

type ActivityActionRouteValue = Readonly<{
  readonly continuationReady: boolean;
  readonly item: ActivityActionItem;
  readonly showsBackButton: boolean;
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
  selectsDefaultAction,
  showsBackButton,
  source,
}: {
  readonly selectsDefaultAction: boolean;
  readonly showsBackButton: boolean;
  readonly source: ActivitySelectionTarget["source"];
}) => {
  const borrowActionId = useWidgetRoutePrefixMatch(
    widgetRoutes.activityBorrowAction
  )?.actionId;
  const yieldActionId = useWidgetRoutePrefixMatch(
    widgetRoutes.activityAction
  )?.actionId;
  const actionIdParam = source === "borrow" ? borrowActionId : yieldActionId;
  const stepsMatch = useWidgetRouteMatch(
    widgetYieldFlowRoutes.YieldActionContinuation.steps
  );
  const completeMatch = useWidgetRouteMatch(
    widgetYieldFlowRoutes.YieldActionContinuation.complete
  );
  const executionMatch = stepsMatch ?? completeMatch;
  const scope = useAtomValue(walletScopeAtom);
  const parsed = parseActivityRouteIntent({
    actionIdParam,
    allowDefault: selectsDefaultAction,
    source,
  });

  if (!scope) return <ActivityDetailsUnavailable />;
  if (parsed.status === "missing" || parsed.status === "invalid") {
    return <WidgetNavigate replace to={widgetRoutes.activity.build()} />;
  }

  return (
    <BoundActivityActionRoute
      showsBackButton={showsBackButton}
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
  selectionKey,
  showsBackButton,
}: {
  readonly selectionKey: ActivitySelectionKey;
  readonly showsBackButton: boolean;
}) => {
  const result = useAtomValue(activityDetailsViewAtom(selectionKey));
  const retry = useAtomSet(retryActivityActionRouteAtom(selectionKey));
  // The action whose Continuation this route mounted from its Review. Its
  // Session lives in this subtree across Review, Steps, and Complete.
  const [continuedActionId, setContinuedActionId] = useState<string | null>(
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
      <WidgetNavigate replace to={widgetRoutes.activity.build()} />
    ) : null;
  }

  const { item } = result;
  const actionId = item.actionData.id;
  const reviewPath = getActivityActionPath(getActivitySelectionTarget(item));
  // Only the explicit action route spans Review, Steps, and Complete, so it is
  // the one that owns a continuation.
  if (result.canContinue && selectionKey.intent._tag === "default") {
    return <WidgetNavigate replace to={reviewPath} />;
  }
  // A continuation started on this action's Review stays mounted through its
  // execution; any other action drops it.
  const nextContinuedActionId =
    result.canContinue || continuedActionId === actionId ? actionId : null;
  if (nextContinuedActionId !== continuedActionId) {
    setContinuedActionId(nextContinuedActionId);
    return null;
  }
  const continuationReady = continuedActionId === actionId;
  if (selectionKey.surface === "execution" && !continuationReady) {
    return <WidgetNavigate replace to={reviewPath} />;
  }

  return (
    <ActivityActionRouteContext.Provider
      value={{
        continuationReady,
        item,
        providersDetails: result.providersDetails,
        showsBackButton,
      }}
    >
      {continuationReady && item._tag === "yield" && item.yieldData ? (
        <YieldActionContinuationSessionRoute
          key={actionId}
          continuation={{
            action: item.actionData,
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
