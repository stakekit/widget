import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { BackButtonProvider } from "../common/components/back-button";
import { VerticalDivider } from "../common/components/divider";
import { FooterOutlet } from "../common/components/footer-outlet";
import { TabPageContainer } from "../common/components/tab-page-container";
import { PositionsPage } from "./positions/positions.page";
import { Summary } from "./summary";

export const OverviewPage = () => {
  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        <Summary />

        <TabPageContainer>
          <Box display="flex" flexDirection="column" flex={1} gap="8" width="0">
            <BackButtonProvider>
              <Outlet />
            </BackButtonProvider>

            <FooterOutlet />
          </Box>

          <VerticalDivider />

          <Box flex={1} width="0">
            <PositionsPage />
          </Box>
        </TabPageContainer>
      </Box>
    </AnimationPage>
  );
};
