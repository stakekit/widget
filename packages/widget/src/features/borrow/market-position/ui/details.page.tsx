import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { EmptyState, Notice, SplitView, Stack } from "../../../../ui/index";
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
import { BorrowPositionDetailsDisclosure } from "./components/position-details-disclosure";
import { BorrowPositionHeader } from "./components/position-header";
import { BorrowPositionSummary } from "./components/position-summary";
import { BorrowPositionRiskAlertNotice } from "./components/risk-alert";
import {
  BorrowPositionActionsSkeleton,
  BorrowPositionInfoSkeleton,
} from "./components/skeletons";
import type {
  BorrowPositionActionSelection,
  BorrowPositionContext,
} from "./context";

/**
 * A market position's own page, laid out as the Earn tab is: on the left
 * the trail back to the positions list, the header and the position's
 * actions with the chosen one's form; on the right the position, its
 * summary, a risk alert and the details with the collateral. A
 * flow's Review, Steps or Complete runs in the left column while the right
 * keeps the position.
 */
export const BorrowPositionDetailsPage = () => {
  useTrackPage("positionDetails");

  const marketId = useWidgetRoutePrefixMatch(
    widgetRoutes.borrowPosition
  )?.marketId;
  const hasNestedRoute =
    useWidgetRouteMatch(widgetRoutes.borrowPosition) === null;
  const actionMatch = useWidgetRouteMatch(widgetRoutes.borrowPositionAction);
  const routeActionId = actionMatch?.actionId ?? null;
  // The actions show on the position and on a link to one action; a flow's
  // Review, Steps or Complete takes their place.
  const showsActions = !hasNestedRoute || actionMatch !== null;
  const navigation = useWidgetNavigate();
  // The page owns the chosen action, so the risk alert's Repay can choose it
  // without a route change that would remount the form. A link to an action
  // chooses it whenever the link changes.
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
  // A failed or in-flight refetch keeps the last known position on screen.
  const presentablePosition = useBorrowPosition(marketId);
  const position =
    presentablePosition._tag === "Ready" ? presentablePosition.value : null;
  const model = position
    ? getBorrowPositionDetailsModel({ locale, position, t })
    : null;
  const actions = position ? getBorrowPositionActions({ position, t }) : [];
  const context: BorrowPositionContext = {
    actions,
    onSelectAction: (actionId) => setSelection({ actionId, focusRequest: 0 }),
    selection,
  };

  // Repay from the risk alert: chooses Repay and focuses its amount, keeping
  // what was typed; from a flow, opens the position on Repay.
  const startRepay = (repay: BorrowPositionAction) => {
    if (showsActions) {
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

  // A closed position (e.g. after a full repay) has nothing to manage; nested
  // flow routes still render so Complete can show the settled result.
  if (!hasNestedRoute && presentablePosition._tag === "Ready" && !position) {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const riskAlert = model?.riskAlert ? (
    <BorrowPositionRiskAlertNotice
      actions={actions}
      alert={model.riskAlert}
      onRepay={startRepay}
    />
  ) : null;

  const details =
    position && model ? (
      <BorrowPositionDetailsDisclosure
        actions={actions}
        model={model}
        onActionSelect={startCollateralReview}
        position={position}
      />
    ) : (
      <EmptyState title={t("dashboard.borrow.position_details.empty")} />
    );

  const info = (() => {
    if (presentablePosition._tag === "Loading") {
      return <BorrowPositionInfoSkeleton />;
    }
    if (presentablePosition._tag === "Failed") {
      return <Notice tone="danger">{t("shared.something_went_wrong")}</Notice>;
    }
    if (!model) return details;
    return (
      <>
        <BorrowPositionSummary model={model} />
        {riskAlert}
        {details}
      </>
    );
  })();

  // Off a flow the header names the position under the trail, then its
  // actions; a flow's own page takes their place and the trail names it.
  const actionsColumn = (() => {
    if (!showsActions) return <Outlet context={context} />;
    if (presentablePosition._tag === "Loading") {
      return <BorrowPositionActionsSkeleton />;
    }
    if (!position || !model) return null;
    return (
      <>
        <BorrowPositionHeader model={model} position={position} />
        <Outlet context={context} />
      </>
    );
  })();

  return (
    <AnimationPage>
      <SplitView
        secondaryLabel={t("dashboard.split_view.details")}
        primary={
          <Stack gap={16}>
            <BorrowPositionBreadcrumb
              positionName={showsActions ? null : (model?.title ?? null)}
            />
            {actionsColumn}
          </Stack>
        }
        secondary={<Stack gap={24}>{info}</Stack>}
      />
    </AnimationPage>
  );
};
