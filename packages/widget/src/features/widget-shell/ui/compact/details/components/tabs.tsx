import { motion } from "motion/react";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../../../services/navigation/widget-routes";
import { Divider } from "../../../../../../shared/ui/components/divider";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { useMountAnimation } from "../../../../../mount-animation/index";
import {
  useWidgetNavigate,
  useWidgetRoutePrefixMatch,
} from "../../../../../navigation/index";
import { useTrackEvent } from "../../../../../tracking/index";
import { useWidgetConfig } from "../../../../../widget-configuration/index";
import { divider } from "../styles.css";
import { Tab } from "./tab";

type TabsList = "earn" | "positions" | "activity";

const TABS_MAP: Record<TabsList, WidgetPath> = {
  earn: widgetRoutes.earn.build(),
  positions: widgetRoutes.positions.build(),
  activity: widgetRoutes.activity.build(),
};

type TabsProps = {
  pendingActionsCount?: number;
};

const Tabs = ({ pendingActionsCount }: TabsProps) => {
  const trackEvent = useTrackEvent();
  const navigation = useWidgetNavigate();

  const positionsMatch = useWidgetRoutePrefixMatch(widgetRoutes.positions);
  const activityMatch = useWidgetRoutePrefixMatch(widgetRoutes.activity);
  const getSelectedTab = (): TabsList => {
    if (positionsMatch) return "positions";
    if (activityMatch) return "activity";
    return "earn";
  };
  const selectedTab = getSelectedTab();

  const onTabPress = (selected: TabsList) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigation.push(TABS_MAP[selected]);
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
