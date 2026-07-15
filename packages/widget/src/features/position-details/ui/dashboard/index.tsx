import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  AnimationPage,
  BackButton,
  BackButtonProvider,
  TabPageContainer,
  VerticalDivider,
} from "../../../widget-shell";
import { usePositionDetails } from "../classic/hooks/use-position-details";
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
  const positionDetails = usePositionDetails();
  const shouldShowActions =
    positionDetailsActionsHasContent(positionDetails) ||
    positionDetailsStakeHasContent(positionDetails);

  const positionName = positionDetails.integrationData?.metadata.name ?? null;

  return (
    <AnimationPage>
      <TabPageContainer>
        {shouldShowActions ? (
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
        ) : null}

        {shouldShowActions ? <VerticalDivider /> : null}

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
      </TabPageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetailsPageComponent />;
