import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { toPresentable } from "../../../../shared/effect/async-result";
import { PositionDetailsPane } from "../../../../shared/ui/components/position-details";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../shared/ui/widget-presentation";
import {
  useWidgetRouteMatch,
  useWidgetRoutePrefixMatch,
} from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useTrackPage } from "../../../tracking/index";
import {
  AnimationPage,
  SplitView,
  type SplitViewSide,
} from "../../../widget-shell/views";
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
import type { BorrowPositionContext } from "./context";

export const BorrowPositionDetailsPage = () => {
  useTrackPage("positionDetails");

  const marketId = useWidgetRoutePrefixMatch(
    widgetRoutes.borrowPosition
  )?.marketId;
  const hasNestedRoute =
    useWidgetRouteMatch(widgetRoutes.borrowPosition) === null;
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const startPositionReview = useAtomSet(startBorrowPositionActionReviewAtom);
  const borrowPosition = useBorrowPosition(marketId);
  // Nested routes remount the split on the Actions side; returning to the
  // position restores the side the user last chose, e.g. Details after a
  // collateral toggle review.
  const [baseSide, setBaseSide] = useState<SplitViewSide>("primary");
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
    position,
  };

  const startCollateralReview = (action: BorrowPositionAction) =>
    startPositionReview(makeBorrowPositionActionRouteKey(action));

  if (isPositionLoading && !hasNestedRoute) {
    return (
      <AnimationPage>
        <SplitView
          primaryBarLabel={t("dashboard.split_view.actions")}
          secondaryBarLabel={t("dashboard.split_view.details")}
          primary={
            <PositionDetailsPane kind="actions">
              <BorrowPositionBreadcrumb positionName={null} />
              <BorrowPositionActionsSkeleton />
            </PositionDetailsPane>
          }
          secondary={
            <PositionDetailsPane kind="info">
              <BorrowPositionInfoSkeleton />
            </PositionDetailsPane>
          }
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
      return (
        <Text variant={{ type: "danger", weight: "normal" }}>
          {t("shared.something_went_wrong")}
        </Text>
      );
    }

    return (
      <BorrowPositionInfo
        actions={actions}
        content={position && model ? "details" : "fallback"}
        model={model}
        onActionSelect={startCollateralReview}
        position={position}
      />
    );
  })();

  return (
    <AnimationPage>
      <SplitView
        key={hasNestedRoute ? "nested" : "base"}
        {...(hasNestedRoute
          ? {}
          : { activeSide: baseSide, onActiveSideChange: setBaseSide })}
        primaryBarLabel={t("dashboard.split_view.actions")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowLeftPane ? (
            <PositionDetailsPane kind="actions">
              <Outlet context={context} />
            </PositionDetailsPane>
          ) : null
        }
        secondary={
          <PositionDetailsPane kind="info">
            {shouldShowLeftPane ? null : (
              <BorrowPositionBreadcrumb positionName={model?.title ?? null} />
            )}

            {rightContent}
          </PositionDetailsPane>
        }
      />
    </AnimationPage>
  );
};
