import { Outlet } from "react-router";
import { EarnDetails } from "../../features/earn/ui";
import {
  AnimationPage,
  BackButtonProvider,
  TabPageContainer,
  VerticalDivider,
} from "../../features/widget-shell";
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
