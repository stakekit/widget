import { Box } from "@sk-widget/components/atoms/box";
import { AnimationPage } from "@sk-widget/navigation/containers/animation-page";
import {
  BackButton,
  BackButtonProvider,
} from "@sk-widget/pages-dashboard/common/components/back-button";
import { FooterOutlet } from "@sk-widget/pages-dashboard/common/components/footer-outlet";
import { TabPageContainer } from "@sk-widget/pages-dashboard/common/components/tab-page-container";
import { positionDetailsActionsHasContent } from "@sk-widget/pages-dashboard/position-details/components/position-details-actions";
import { PositionDetailsInfo } from "@sk-widget/pages-dashboard/position-details/components/position-details-info";
import { TopHeader } from "@sk-widget/pages-dashboard/position-details/components/top-header";
import {
  headerContainer,
  posistionDetailsInfoContainer,
} from "@sk-widget/pages-dashboard/position-details/styles.css";
import { usePositionDetails } from "@sk-widget/pages/position-details/hooks/use-position-details";
import { UnstakeOrPendingActionProvider } from "@sk-widget/pages/position-details/state";
import { Outlet } from "react-router";

const PositionDetailsPageComponent = () => {
  const shouldShowActions = positionDetailsActionsHasContent(
    usePositionDetails()
  );

  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        <Box className={headerContainer}>
          <BackButtonProvider>
            <BackButton />
          </BackButtonProvider>

          <TopHeader />
        </Box>

        <TabPageContainer>
          {shouldShowActions && (
            <Box
              display="flex"
              flexDirection="column"
              flex={1}
              gap="8"
              width="0"
            >
              <Outlet />

              <FooterOutlet />
            </Box>
          )}

          <Box className={posistionDetailsInfoContainer}>
            <PositionDetailsInfo />
          </Box>
        </TabPageContainer>
      </Box>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => (
  <UnstakeOrPendingActionProvider>
    <PositionDetailsPageComponent />
  </UnstakeOrPendingActionProvider>
);
