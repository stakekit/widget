import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { SplitView, Stack } from "../../../../ui/index";
import { useWidgetRoutePrefixMatch } from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import {
  AnimationPage,
  BackButton,
  BackButtonProvider,
} from "../../../widget-shell/views";
import { resolvePositionDetailsPageLayout } from "../../model/hub";
import { usePositionDetails } from "../../react/use-position-details";
import { PositionHeader } from "../components/position-header";
import { PositionDetailsInfo } from "./components/position-details-info";
import {
  PositionDetailsBreadcrumb,
  PositionDetailsPane,
} from "./components/position-details-layout";

const PositionBreadcrumb = ({
  positionName,
}: {
  positionName: string | null;
}) => {
  const { t } = useTranslation();

  return (
    <BackButtonProvider>
      <PositionDetailsBreadcrumb
        backButton={<BackButton />}
        positionName={positionName}
        rootLabel={t("dashboard.position_details.breadcrumb_root")}
      />
    </BackButtonProvider>
  );
};

const PositionDetailsPageComponent = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const enterFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionStake);
  const exitFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionUnstake);
  const pendingActionFlow = useWidgetRoutePrefixMatch(
    widgetRoutes.positionPendingAction
  );
  const flowActive =
    enterFlow !== null || exitFlow !== null || pendingActionFlow !== null;
  const layout = resolvePositionDetailsPageLayout({
    ...positionDetails,
    flowActive,
  });

  if (layout === "PositionLost") {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const shouldShowActions = layout === "Actions";
  // Off a flow the header names the position, so the trail stops at its root.
  const positionName = flowActive
    ? (positionDetails.integrationData?.metadata.name ?? null)
    : null;
  const header = flowActive ? null : <PositionHeader />;

  return (
    <AnimationPage>
      <SplitView
        secondaryLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowActions ? (
            <PositionDetailsPane kind="actions">
              <PositionBreadcrumb positionName={positionName} />
              {header}

              <Stack grow gap={32} justify="between">
                <Outlet />
              </Stack>
            </PositionDetailsPane>
          ) : null
        }
        secondary={
          <PositionDetailsPane kind="info">
            {shouldShowActions ? null : (
              <>
                <PositionBreadcrumb positionName={positionName} />
                {header}
              </>
            )}

            <PositionDetailsInfo />
          </PositionDetailsPane>
        }
      />
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetailsPageComponent />;
