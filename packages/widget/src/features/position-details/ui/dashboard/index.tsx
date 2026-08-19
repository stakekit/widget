import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import {
  PositionDetailsBreadcrumb as PositionDetailsBreadcrumbLayout,
  PositionDetailsPane,
} from "../../../../shared/ui/components/position-details";
import { Box } from "../../../../shared/ui/primitives/box";
import {
  AnimationPage,
  BackButton,
  BackButtonProvider,
  SplitView,
} from "../../../widget-shell/views";
import { usePositionDetails } from "../classic/hooks/use-position-details";
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

export const positionDetailsPageShouldShowActionsPane = (
  positionDetails: ReturnType<typeof usePositionDetails>
) =>
  positionDetails.isLoading ||
  (!!positionDetails.integrationData &&
    !!positionDetails.positionBalancesByType);

const PositionDetailsPageComponent = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const shouldShowActions =
    positionDetailsPageShouldShowActionsPane(positionDetails);

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
