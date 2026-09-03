import { useAtomSet } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useParams } from "react-router";
import { PositionDetailsPane } from "../../../../shared/ui/components/position-details";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage, SplitView } from "../../../widget-shell/views";
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
import {
  type BorrowPositionContext,
  getBorrowPositionBasePath,
} from "./context";

const getPositionFromResult = (
  borrowPosition: ReturnType<typeof useBorrowPosition>
) =>
  AsyncResult.isSuccess(borrowPosition.positionResult)
    ? borrowPosition.positionResult.value
    : null;

export const BorrowPositionDetailsPage = () => {
  useTrackPage("positionDetails");

  const { marketId } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const startPositionReview = useAtomSet(startBorrowPositionActionReviewAtom);
  const borrowPosition = useBorrowPosition(marketId);
  const position = getPositionFromResult(borrowPosition);
  const model = position
    ? getBorrowPositionDetailsModel({ position, t })
    : null;
  const actions = position
    ? getBorrowPositionActions({
        position,
        t,
      })
    : [];
  const isPositionLoading =
    AsyncResult.isInitial(borrowPosition.positionResult) ||
    AsyncResult.isWaiting(borrowPosition.positionResult);
  const positionBasePath = getBorrowPositionBasePath(marketId);
  const normalizedPathname = location.pathname.replace(/\/+$/u, "");
  const hasNestedRoute = normalizedPathname !== positionBasePath;
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

  const rightContent = (() => {
    if (isPositionLoading) {
      return <BorrowPositionInfoSkeleton />;
    }

    if (AsyncResult.isFailure(borrowPosition.positionResult)) {
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
