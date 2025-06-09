import { Box } from "@sk-widget/components/atoms/box";
import { AnimationPage } from "@sk-widget/navigation/containers/animation-page";
import { VerticalDivider } from "@sk-widget/pages-dashboard/common/components/divider";
import { TabPageContainer } from "@sk-widget/pages-dashboard/common/components/tab-page-container";
import { Summary } from "@sk-widget/pages-dashboard/rewards/components/summary";
import { RewardsPage } from "@sk-widget/pages-dashboard/rewards/rewards.page";
import { rewardDetailsContainer } from "@sk-widget/pages-dashboard/rewards/styles.css";
import { lazy } from "react";

const RewardsDetailsTab = lazy(() =>
  import("./reward-details.tab").then((mod) => ({
    default: mod.RewardsDetailsTab,
  }))
);

export const RewardsTabPage = () => {
  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        <Summary />

        <TabPageContainer>
          <RewardsPage />

          <VerticalDivider />

          <Box flex={1} width="0" className={rewardDetailsContainer}>
            <RewardsDetailsTab />
          </Box>
        </TabPageContainer>
      </Box>
    </AnimationPage>
  );
};
