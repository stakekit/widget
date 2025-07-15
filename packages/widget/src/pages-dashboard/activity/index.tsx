// import { Summary } from "../rewards/components/summary";
import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { VerticalDivider } from "../common/components/divider";
import { TabPageContainer } from "../common/components/tab-page-container";
import { ActivityPage } from "./activity.page";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        {/* <Summary /> */}

        <TabPageContainer>
          <ActivityPage />

          <VerticalDivider />

          <Box flex={1} width="0" className={activityDetailsContainer}>
            <Outlet />
          </Box>
        </TabPageContainer>
      </Box>
    </AnimationPage>
  );
};
