import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Box } from "../../../../components/atoms/box";
import { Divider } from "../../../../components/atoms/divider";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useSKLocation } from "../../../../providers/location";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { useSettings } from "../../../../providers/settings";
import { divider } from "../styles.css";
import { Tab } from "./tab";

type TabsList = "earn" | "positions" | "activity";

const TABS_MAP = {
  earn: "/",
  positions: "/positions",
  activity: "/activity",
};

type TabsProps = {
  pendingActionsCount?: number;
};

const Tabs = ({ pendingActionsCount }: TabsProps) => {
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

  const useImmediateState = state.layout || disableInitLayoutAnimation;
  const initial = useImmediateState
    ? { opacity: 1, translateY: 0 }
    : { opacity: 0, translateY: "-40px" };
  const animate = {
    opacity: 1,
    translateY: 0,
    transition: useImmediateState
      ? { duration: 0 }
      : { duration: 1, delay: 0.5 },
  };

  return (
    <motion.div initial={initial} animate={animate}>
      <Tabs {...props} />
    </motion.div>
  );
};
