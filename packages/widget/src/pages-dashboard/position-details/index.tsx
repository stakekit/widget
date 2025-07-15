import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { usePositionDetails } from "../../pages/position-details/hooks/use-position-details";
import { UnstakeOrPendingActionProvider } from "../../pages/position-details/state";
import {
  BackButton,
  BackButtonProvider,
} from "../common/components/back-button";
import { FooterOutlet } from "../common/components/footer-outlet";
import { TabPageContainer } from "../common/components/tab-page-container";
import { positionDetailsActionsHasContent } from "./components/position-details-actions";
import { PositionDetailsInfo } from "./components/position-details-info";
import { TopHeader } from "./components/top-header";
import { headerContainer, posistionDetailsInfoContainer } from "./styles.css";

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
