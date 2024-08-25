import { Box, Divider, Text } from "@sk-widget/components";
import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { SelectAction } from "@sk-widget/pages/details/activity-page/components/select-action";
import { SelectNetwork } from "@sk-widget/pages/details/activity-page/components/select-network";
import { SelectToken } from "@sk-widget/pages/details/activity-page/components/select-token";
import { ActivityPageContextProvider } from "@sk-widget/pages/details/activity-page/state/activiti-page.context";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import { motion } from "framer-motion";
import { PageContainer } from "../../components";
import { container } from "./style.css";

export const ActivityPageComponent = () => {
  useTrackPage("activity");

  const { mountAnimationFinished } = useMountAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, translateY: "-10px" }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 1.5,
      }}
    >
      <PageContainer>
        <Box
          className={container}
          display="flex"
          flex={1}
          flexDirection="column"
        >
          <Text marginBottom="1">Follow Steps</Text>
          <Box display="flex" gap="2">
            <SelectNetwork />
            <SelectToken />
            <SelectAction />
          </Box>
          <Divider my="6" />
        </Box>
      </PageContainer>
    </motion.div>
  );
};

export const ActivityPage = () => (
  <ActivityPageContextProvider>
    <ActivityPageComponent />
  </ActivityPageContextProvider>
);
