import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  posistionDetailsInfoContainer,
  positionDetailsActionsContainer,
} from "../../../position-details/ui";
import { useTrackPage } from "../../../tracking/state";
import { AnimationPage, SplitView } from "../../../widget-shell/components";
import { useBorrowPosition } from "../../positions/react/use-borrow-positions";
import {
  type BorrowPositionAction,
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "../model/details";
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
  const navigate = useNavigate();
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

  const openAction = (action: BorrowPositionAction) => {
    navigate(`${getBorrowPositionBasePath(marketId)}/action/${action.id}`);
  };

  if (isPositionLoading && !hasNestedRoute) {
    return (
      <AnimationPage>
        <SplitView
          primaryBarLabel={t("dashboard.split_view.actions")}
          secondaryBarLabel={t("dashboard.split_view.details")}
          primary={
            <Box
              className={positionDetailsActionsContainer}
              display="flex"
              flex={1}
              flexDirection="column"
              gap="4"
              width="0"
            >
              <BorrowPositionBreadcrumb positionName={null} />
              <BorrowPositionActionsSkeleton />
            </Box>
          }
          secondary={
            <Box
              className={posistionDetailsInfoContainer}
              display="flex"
              flexDirection="column"
              gap="4"
            >
              <BorrowPositionInfoSkeleton />
            </Box>
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
        onActionSelect={openAction}
        position={position}
      />
    );
  })();

  return (
    <AnimationPage>
      <SplitView
        primaryBarLabel={t("dashboard.split_view.actions")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowLeftPane ? (
            <Box
              className={positionDetailsActionsContainer}
              display="flex"
              flex={1}
              flexDirection="column"
              gap="4"
              width="0"
            >
              <Outlet context={context} />
            </Box>
          ) : null
        }
        secondary={
          <Box
            className={posistionDetailsInfoContainer}
            display="flex"
            flexDirection="column"
            gap="4"
          >
            {shouldShowLeftPane ? null : (
              <BorrowPositionBreadcrumb positionName={model?.title ?? null} />
            )}

            {rightContent}
          </Box>
        }
      />
    </AnimationPage>
  );
};
