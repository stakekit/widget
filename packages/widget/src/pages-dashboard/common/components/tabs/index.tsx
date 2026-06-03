import { Match } from "effect";
import { startsWith } from "effect/String";
import { useNavigate } from "react-router";
import { Box } from "../../../../components/atoms/box";
import { Divider } from "../../../../components/atoms/divider";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useSKLocation } from "../../../../providers/location";
import { useSettings } from "../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../utils/styles";
import { divider, tabsContainer, tabsWrapper } from "./styles.css";
import { Tab } from "./tab";

type TabsList = "earn" | "manage" | "activity";

const TABS_MAP = {
  earn: "/",
  manage: "/manage",
  activity: "/activity",
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

  const selectedTab = Match.value(current.pathname).pipe(
    Match.when(startsWith("/activity"), () => "activity"),
    Match.when(startsWith("/manage"), () => "manage"),
    Match.orElse(() => "earn")
  );

  const { variant } = useSettings();

  return (
    <Box className={combineRecipeWithVariant({ rec: tabsWrapper, variant })}>
      <Box
        data-rk="tabs-section"
        className={combineRecipeWithVariant({ rec: tabsContainer, variant })}
      >
        <Tab
          isSelected={selectedTab === "earn"}
          onTabPress={() => onTabPress("earn")}
          variant="earn"
        />

        <Tab
          isSelected={selectedTab === "manage"}
          onTabPress={() => onTabPress("manage")}
          variant="manage"
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
