import { Box } from "@sk-widget/components/atoms/box";
import { AnimationPage } from "@sk-widget/navigation/containers/animation-page";
import { BackButtonProvider } from "@sk-widget/pages-dashboard/common/components/back-button";
import { VerticalDivider } from "@sk-widget/pages-dashboard/common/components/divider";
import { FooterOutlet } from "@sk-widget/pages-dashboard/common/components/footer-outlet";
import { TabPageContainer } from "@sk-widget/pages-dashboard/common/components/tab-page-container";
import { PositionsPage } from "@sk-widget/pages-dashboard/overview/positions/positions.page";
import { Summary } from "@sk-widget/pages-dashboard/overview/summary";
import { Outlet } from "react-router";

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
