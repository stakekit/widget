import { useAtomSet } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { VerticalDivider } from "../../../../shared/ui/components/divider";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  posistionDetailsInfoContainer,
  positionDetailsActionsContainer,
} from "../../../position-details/ui";
import { useTrackPage } from "../../../tracking/state";
import {
  AnimationPage,
  TabPageContainer,
} from "../../../widget-shell/components";
import {
  type BorrowPositionAction,
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "../../model/position-details-model";
import { useBorrowPosition } from "../../react/use-borrow-positions";
import { stageBorrowPositionActionAtom } from "../../state/position-action-form";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { BorrowPositionInfo } from "./components/position-info";
import {
  BorrowPositionActionsSkeleton,
  BorrowPositionInfoSkeleton,
} from "./components/skeletons";
import {
  type BorrowPositionContext,
  getBorrowPositionBasePath,
} from "./position-context";

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
  const stageBorrowAction = useAtomSet(stageBorrowPositionActionAtom);
  const borrowPosition = useBorrowPosition(marketId);
  const position = getPositionFromResult(borrowPosition);
  const model = position
    ? getBorrowPositionDetailsModel({ position, t })
    : null;
  const actions = position
    ? getBorrowPositionActions({
        address: borrowPosition.walletBridge.wallet.currentAccount.address,
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
    stageBorrowAction(action);
    navigate(`${getBorrowPositionBasePath(marketId)}/action/${action.id}`);
  };

  if (isPositionLoading && !hasNestedRoute) {
    return (
      <AnimationPage>
        <TabPageContainer>
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

          <VerticalDivider />

          <Box
            className={posistionDetailsInfoContainer}
            display="flex"
            flexDirection="column"
            gap="4"
          >
            <BorrowPositionInfoSkeleton />
          </Box>
        </TabPageContainer>
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
      <TabPageContainer>
        {shouldShowLeftPane ? (
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
        ) : null}

        {shouldShowLeftPane ? <VerticalDivider /> : null}

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
      </TabPageContainer>
    </AnimationPage>
  );
};
