import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import {
  PositionDetailsBreadcrumb as PositionDetailsBreadcrumbLayout,
  PositionDetailsPane,
} from "../../../../shared/ui/components/position-details";
import { Box } from "../../../../shared/ui/primitives/box";
import { useWidgetRoutePrefixMatch } from "../../../navigation/index";
import { WidgetNavigate } from "../../../navigation/views";
import {
  AnimationPage,
  BackButton,
  BackButtonProvider,
  SplitView,
} from "../../../widget-shell/views";
import { resolvePositionDetailsPageLayout } from "../../model/hub";
import { usePositionDetails } from "../../react/use-position-details";
import { PositionDetailsInfo } from "./components/position-details-info";

const PositionBreadcrumb = ({
  positionName,
}: {
  positionName: string | null;
}) => {
  const { t } = useTranslation();

  return (
    <BackButtonProvider>
      <PositionDetailsBreadcrumbLayout
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
  const stakeFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionStake);
  const unstakeFlow = useWidgetRoutePrefixMatch(widgetRoutes.positionUnstake);
  const pendingActionFlow = useWidgetRoutePrefixMatch(
    widgetRoutes.positionPendingAction
  );
  const layout = resolvePositionDetailsPageLayout({
    ...positionDetails,
    flowActive:
      stakeFlow !== null || unstakeFlow !== null || pendingActionFlow !== null,
  });

  if (layout === "PositionLost") {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const shouldShowActions = layout === "Actions";
  const positionName = positionDetails.integrationData?.metadata.name ?? null;

  return (
    <AnimationPage>
      <SplitView
        primaryBarLabel={t("dashboard.split_view.actions")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowActions ? (
            <PositionDetailsPane kind="actions">
              <PositionBreadcrumb positionName={positionName} />

              <Box
                display="flex"
                flex={1}
                flexDirection="column"
                gap="8"
                justifyContent="space-between"
              >
                <Outlet />
              </Box>
            </PositionDetailsPane>
          ) : null
        }
        secondary={
          <PositionDetailsPane kind="info">
            {shouldShowActions ? null : (
              <PositionBreadcrumb positionName={positionName} />
            )}

            <PositionDetailsInfo />
          </PositionDetailsPane>
        }
      />
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetailsPageComponent />;
