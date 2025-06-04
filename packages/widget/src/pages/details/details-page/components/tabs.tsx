import { Box } from "@sk-widget/components/atoms/box";
import { Divider } from "@sk-widget/components/atoms/divider";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import { useSKLocation } from "@sk-widget/providers/location";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import { useSettings } from "@sk-widget/providers/settings";
import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { Just } from "purify-ts";
import { useNavigate } from "react-router";
import { divider } from "../styles.css";
import { Tab } from "./tab";

type TabsList = "earn" | "positions" | "activity";

const TABS_MAP = {
  earn: "/",
  positions: "/positions",
  activity: "/activity",
};

export type TabsProps = {
  pendingActionsCount?: number;
};

export const Tabs = ({ pendingActionsCount }: TabsProps) => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();

  const { current } = useSKLocation();

  const onTabPress = (selected: TabsList) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigate(TABS_MAP[selected]);
  };

  const selectedTab = current.pathname.startsWith("/positions")
    ? "positions"
    : current.pathname.startsWith("/activity")
      ? "activity"
      : "earn";

  return (
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
  );
};

export const AnimatedTabs = (props: TabsProps) => {
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
      <Tabs {...props} />
    </motion.div>
  );
};
