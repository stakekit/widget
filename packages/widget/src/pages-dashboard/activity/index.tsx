import { Box } from "@sk-widget/components/atoms/box";
import { AnimationPage } from "@sk-widget/navigation/containers/animation-page";
import { ActivityPage } from "@sk-widget/pages-dashboard/activity/activity.page";
import { activityDetailsContainer } from "@sk-widget/pages-dashboard/activity/styles.css";
import { VerticalDivider } from "@sk-widget/pages-dashboard/common/components/divider";
import { TabPageContainer } from "@sk-widget/pages-dashboard/common/components/tab-page-container";
// import { Summary } from "@sk-widget/pages-dashboard/rewards/components/summary";
import { Outlet } from "react-router";

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
