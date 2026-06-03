import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { EarnPageContextProvider } from "../../pages/details/earn-page/state/earn-page-context";
import { EarnPageStateUsageBoundaryProvider } from "../../pages/details/earn-page/state/earn-page-state-context";
import { BackButtonProvider } from "../common/components/back-button";
import { VerticalDivider } from "../common/components/divider";
import { FooterOutlet } from "../common/components/footer-outlet";
import { TabPageContainer } from "../common/components/tab-page-container";
import { EarnDetails } from "./earn-details";
import { earnDetailsWrapper } from "./earn-details/styles.css";

export const OverviewPage = () => {
  return (
    <EarnPageStateUsageBoundaryProvider>
      <EarnPageContextProvider>
        <AnimationPage>
          <Box display="flex" flexDirection="column" gap="4">
            <TabPageContainer>
              <Box
                display="flex"
                flex={1}
                flexDirection="column"
                gap="8"
                width="0"
              >
                <BackButtonProvider>
                  <Outlet />
                </BackButtonProvider>

                <FooterOutlet />
              </Box>

              <VerticalDivider />

              <Box className={earnDetailsWrapper} flex={1} width="0">
                <EarnDetails />
              </Box>
            </TabPageContainer>
          </Box>
        </AnimationPage>
      </EarnPageContextProvider>
    </EarnPageStateUsageBoundaryProvider>
  );
};
