import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { Text } from "../../components/atoms/typography/text";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { usePositionDetails } from "../../pages/position-details/hooks/use-position-details";
import { UnstakeOrPendingActionProvider } from "../../pages/position-details/state";
import {
  BackButton,
  BackButtonProvider,
} from "../common/components/back-button";
import { SplitView } from "../common/components/split-view";
import {
  positionDetailsActionsHasContent,
  positionDetailsStakeHasContent,
} from "./components/position-details-actions";
import { PositionDetailsInfo } from "./components/position-details-info";
import {
  breadcrumb,
  breadcrumbName,
  posistionDetailsInfoContainer,
  positionDetailsActionsContainer,
} from "./styles.css";

const PositionBreadcrumb = ({
  positionName,
}: {
  positionName: string | null;
}) => {
  const { t } = useTranslation();

  return (
    <BackButtonProvider>
      <Box className={breadcrumb}>
        <BackButton />

        <Text variant={{ weight: "bold" }}>
          {t("dashboard.position_details.breadcrumb_root")}
        </Text>

        {positionName ? (
          <Text
            className={breadcrumbName}
            variant={{ type: "muted", weight: "normal" }}
          >
            {`/ ${positionName}`}
          </Text>
        ) : null}
      </Box>
    </BackButtonProvider>
  );
};

const PositionDetailsPageComponent = () => {
  const { t } = useTranslation();
  const positionDetails = usePositionDetails();
  const shouldShowActions =
    positionDetailsActionsHasContent(positionDetails) ||
    positionDetailsStakeHasContent(positionDetails);

  const positionName = positionDetails.integrationData
    .map((yieldDto) => yieldDto.metadata.name)
    .extractNullable();

  return (
    <AnimationPage>
      <SplitView
        primaryBarLabel={t("dashboard.split_view.actions")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          shouldShowActions ? (
            <Box
              className={positionDetailsActionsContainer}
              display="flex"
              flexDirection="column"
              flex={1}
              gap="4"
              width="0"
            >
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
            {shouldShowActions ? null : (
              <PositionBreadcrumb positionName={positionName} />
            )}

            <PositionDetailsInfo />
          </Box>
        }
      />
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => (
  <UnstakeOrPendingActionProvider>
    <PositionDetailsPageComponent />
  </UnstakeOrPendingActionProvider>
);
