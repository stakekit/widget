import { Outlet } from "react-router";
import { EarnDetails } from "../../features/earn/ui/dashboard/earn-details";
import { AnimationPage } from "../../features/widget-shell/animation-page";
import { BackButtonProvider } from "../../features/widget-shell/dashboard/components/back-button";
import { VerticalDivider } from "../../features/widget-shell/dashboard/components/divider";
import { TabPageContainer } from "../../features/widget-shell/dashboard/components/tab-page-container";
import { Box } from "../../shared/ui/primitives/box";
import {
  earnDetailsWrapper,
  overviewPageContainer,
} from "./dashboard-overview.css";

export const DashboardOverview = () => (
  <AnimationPage>
    <Box display="flex" flexDirection="column" gap="4">
      <TabPageContainer>
        <Box
          className={overviewPageContainer}
          display="flex"
          flex={1}
          flexDirection="column"
          gap="8"
          justifyContent="space-between"
          width="0"
        >
          <BackButtonProvider>
            <Outlet />
          </BackButtonProvider>
        </Box>

        <VerticalDivider />

        <Box className={earnDetailsWrapper} flex={1} width="0">
          <EarnDetails />
        </Box>
      </TabPageContainer>
    </Box>
  </AnimationPage>
);
