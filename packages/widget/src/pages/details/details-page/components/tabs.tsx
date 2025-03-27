import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { Just } from "purify-ts";
import { Box, Divider } from "../../../../components";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { useSettings } from "../../../../providers/settings";
import { divider } from "../styles.css";
import { Tab } from "./tab";

export type TabsList = "earn" | "positions" | "activity";

export type TabsProps = {
  selectedTab: TabsList;
  onTabPress: (selected: TabsList) => void;
  pendingActionsCount?: number;
};

export const Tabs = ({
  selectedTab,
  onTabPress,
  pendingActionsCount,
}: TabsProps) => {
  const { state } = useMountAnimation();

  const { disableInitLayoutAnimation } = useSettings();

  const { animate, initial } = Just({ opacity: 1, translateY: 0 })
    .chain<{ animate: TargetAndTransition; initial: MotionProps["initial"] }>(
      (animateTo) =>
        Just(null)
          .map<{
            transition: MotionProps["transition"];
            initial: MotionProps["initial"];
          }>(() => {
            if (state.layout || disableInitLayoutAnimation) {
              return {
                transition: { duration: 0 },
                initial: { opacity: 1, translateY: 0 },
              };
            }

            return {
              transition: { duration: 1, delay: 0.5 },
              initial: { opacity: 0, translateY: "-40px" },
            };
          })
          .map((val) => ({
            animate: { ...animateTo, transition: val.transition },
            initial: val.initial,
          }))
    )
    .unsafeCoerce();

  return (
    <motion.div initial={initial} animate={animate}>
      <Box position="relative" display="flex" justifyContent="center">
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          data-rk="tabs-section"
          zIndex="simple"
        >
          <Tab
            isSelected={selectedTab === "earn"}
            onTabPress={() => onTabPress("earn")}
            variant="earn"
          />

          <Tab
            isSelected={selectedTab === "positions"}
            onTabPress={() => onTabPress("positions")}
            variant="positions"
            pendingActionsCount={pendingActionsCount}
          />

          <Tab
            isSelected={selectedTab === "activity"}
            onTabPress={() => onTabPress("activity")}
            variant="activity"
          />
        </Box>

        <Box className={divider}>
          <Divider />
        </Box>
      </Box>
    </motion.div>
  );
};
