import { useNavigate } from "react-router";
import { Box } from "../../../../components/atoms/box";
import { Divider } from "../../../../components/atoms/divider";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useSKLocation } from "../../../../providers/location";
import { useSettings } from "../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../utils/styles";
import { divider, tabsContainer, tabsWrapper } from "./styles.css";
import { Tab } from "./tab";

type TabsList =
  | "overview"
  //  "rewards" |
  | "activity";

const TABS_MAP = {
  overview: "/",
  // rewards: "/rewards",
  activity: "/activity",
};

export type TabsProps = {
  pendingActionsCount?: number;
};

export const Tabs = () => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();

  const { current } = useSKLocation();

  const onTabPress = (selected: TabsList) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigate(TABS_MAP[selected]);
  };

  const selectedTab = current.pathname.startsWith("/rewards")
    ? "rewards"
    : current.pathname.startsWith("/activity")
      ? "activity"
      : "overview";

  const { variant } = useSettings();

  return (
    <Box className={combineRecipeWithVariant({ rec: tabsWrapper, variant })}>
      <Box
        data-rk="tabs-section"
        className={combineRecipeWithVariant({ rec: tabsContainer, variant })}
      >
        <Tab
          isSelected={selectedTab === "overview"}
          onTabPress={() => onTabPress("overview")}
          variant="overview"
        />

        {/* <Tab
          isSelected={selectedTab === "rewards"}
          onTabPress={() => onTabPress("rewards")}
          variant="rewards"
        /> */}

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
