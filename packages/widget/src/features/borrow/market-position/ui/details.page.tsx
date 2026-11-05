import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { toPresentable } from "../../../../shared/effect/async-result";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Notice, SplitView, Stack } from "../../../../ui/index";
import {
  useWidgetNavigate,
  useWidgetRouteMatch,
  useWidgetRoutePrefixMatch,
} from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage } from "../../../widget-shell/views";
import { useBorrowPosition } from "../../positions/index";
import {
  type BorrowPositionAction,
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "../model/details";
import {
  makeBorrowPositionActionRouteKey,
  startBorrowPositionActionReviewAtom,
} from "../state/action-form";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { BorrowPositionInfo } from "./components/position-info";
import {
  BorrowPositionActionsSkeleton,
  BorrowPositionInfoSkeleton,
} from "./components/skeletons";
import type {
  BorrowPositionActionSelection,
  BorrowPositionContext,
} from "./context";

export const BorrowPositionDetailsPage = () => {
  useTrackPage("positionDetails");

  const marketId = useWidgetRoutePrefixMatch(
    widgetRoutes.borrowPosition
  )?.marketId;
  const hasNestedRoute =
    useWidgetRouteMatch(widgetRoutes.borrowPosition) === null;
  const actionMatch = useWidgetRouteMatch(widgetRoutes.borrowPositionAction);
  const routeActionId = actionMatch?.actionId ?? null;
  // The actions pane shows on the position and on a link to one action; a
  // flow's Review, Steps or Complete takes its place.
  const showsActionsPane = !hasNestedRoute || actionMatch !== null;
  const navigation = useWidgetNavigate();
  // The page owns the tab, so the risk alert's Repay can select it without
  // a route change that would remount the form. A link to an action selects
  // its tab whenever the link changes.
  const [selection, setSelection] = useState<BorrowPositionActionSelection>({
    actionId: routeActionId,
    focusRequest: 0,
  });
  const [linkedActionId, setLinkedActionId] = useState(routeActionId);
  if (routeActionId !== linkedActionId) {
    setLinkedActionId(routeActionId);
    if (routeActionId !== null) {
      setSelection({ actionId: routeActionId, focusRequest: 0 });
    }
  }
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const startPositionReview = useAtomSet(startBorrowPositionActionReviewAtom);
  const borrowPosition = useBorrowPosition(marketId);
  // A failed or in-flight refetch keeps the last known position on screen.
  const presentablePosition = toPresentable(borrowPosition.positionResult);
  const position =
    presentablePosition._tag === "Ready" ? presentablePosition.value : null;
  const model = position
    ? getBorrowPositionDetailsModel({ locale, position, t })
    : null;
  const actions = position
    ? getBorrowPositionActions({
        position,
        t,
      })
    : [];
  const isPositionLoading = presentablePosition._tag === "Loading";
  const shouldShowLeftPane = hasNestedRoute || actions.length > 0 || !!position;
  const context: BorrowPositionContext = {
    actions,
    borrowPosition,
    model,
    onSelectAction: (actionId) => setSelection({ actionId, focusRequest: 0 }),
    position,
    selection,
  };

  // Repay from the risk alert: selects the Repay tab and focuses its amount,
  // keeping what was typed; from a flow, opens the position on Repay.
  const startRepay = (repay: BorrowPositionAction) => {
    if (showsActionsPane) {
      setSelection((current) => ({
        actionId: repay.id,
        focusRequest: current.focusRequest + 1,
      }));
      return;
    }
    if (marketId === undefined) return;
    void navigation.push(
      widgetRoutes.borrowPositionAction.build("Dashboard", {
        actionId: repay.id,
        marketId,
      })
    );
  };

  const startCollateralReview = (action: BorrowPositionAction) =>
    startPositionReview(makeBorrowPositionActionRouteKey(action));

  if (isPositionLoading && !hasNestedRoute) {
    return (
      <AnimationPage>
        <SplitView
          secondaryLabel={t("dashboard.split_view.details")}
          primary={
            <Stack gap={16}>
              <BorrowPositionBreadcrumb positionName={null} />
              <BorrowPositionActionsSkeleton />
            </Stack>
          }
          secondary={<BorrowPositionInfoSkeleton />}
        />
      </AnimationPage>
    );
  }

  // A closed position (e.g. after a full repay) has nothing to manage; nested
  // flow routes still render so Complete can show the settled result.
  if (!hasNestedRoute && presentablePosition._tag === "Ready" && !position) {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const rightContent = (() => {
    if (isPositionLoading) {
      return <BorrowPositionInfoSkeleton />;
    }

    if (presentablePosition._tag === "Failed") {
      return <Notice tone="danger">{t("shared.something_went_wrong")}</Notice>;
    }

    return (
      <BorrowPositionInfo
        actions={actions}
        content={position && model ? "details" : "fallback"}
        model={model}
        onActionSelect={startCollateralReview}
        onRepay={startRepay}
        position={position}
      />
    );
  })();

  return (
    <AnimationPage>
      <SplitView
        secondaryLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowLeftPane ? (
            <Stack gap={16}>
              <Outlet context={context} />
            </Stack>
          ) : null
        }
        secondary={
          <Stack gap={16}>
            {shouldShowLeftPane ? null : (
              <BorrowPositionBreadcrumb positionName={model?.title ?? null} />
            )}

            {rightContent}
          </Stack>
        }
      />
    </AnimationPage>
  );
};
