import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { useWidgetConfig } from "../../../../app/config/use-widget-config";
import { Divider } from "../../../../shared/ui/components/divider";
import { Box } from "../../../../shared/ui/primitives/box";
import { useMountAnimation } from "../../../mount-animation/state";
import { useTrackEvent } from "../../../tracking/state";
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

  const location = useLocation();
  const getSelectedTab = (): TabsList => {
    if (location.pathname.startsWith("/positions")) return "positions";
    if (location.pathname.startsWith("/activity")) return "activity";
    return "earn";
  };
  const selectedTab = getSelectedTab();

  const onTabPress = (selected: TabsList) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigate(TABS_MAP[selected]);
  };

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
  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );

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
