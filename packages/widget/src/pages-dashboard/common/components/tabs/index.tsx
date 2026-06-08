import { Match } from "effect";
import { startsWith } from "effect/String";
import { useNavigate } from "react-router";
import { Box } from "../../../../components/atoms/box";
import { Divider } from "../../../../components/atoms/divider";
import type { DashboardYieldCategory } from "../../../../domain/types/yields";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useEarnPageContext } from "../../../../pages/details/earn-page/state/earn-page-context";
import { useSKLocation } from "../../../../providers/location";
import { useSettings } from "../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../utils/styles";
import {
  divider,
  tabsContainer,
  tabsGroupDivider,
  tabsWrapper,
} from "./styles.css";
import { Tab } from "./tab";

type RouteTab = "manage" | "activity";

const TABS_MAP = {
  manage: "/manage",
  activity: "/activity",
};

export const Tabs = () => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();
  const {
    availableDashboardYieldCategories,
    onDashboardYieldCategorySelect,
    selectedDashboardYieldCategory,
  } = useEarnPageContext();

  const { current } = useSKLocation();

  const onRouteTabPress = (selected: RouteTab) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigate(TABS_MAP[selected]);
  };

  const onYieldCategoryPress = (category: DashboardYieldCategory) => {
    if (selectedTab === "earn" && selectedDashboardYieldCategory === category) {
      return;
    }

    trackEvent("tabClicked", { selected: category });
    onDashboardYieldCategorySelect(category);
    navigate("/");
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
        {availableDashboardYieldCategories.map((category) => (
          <Tab
            isSelected={
              selectedTab === "earn" &&
              selectedDashboardYieldCategory === category
            }
            key={category}
            onTabPress={() => onYieldCategoryPress(category)}
            variant={category}
          />
        ))}

        {availableDashboardYieldCategories.length > 0 ? (
          <Box className={tabsGroupDivider} />
        ) : null}

        <Tab
          isSelected={selectedTab === "manage"}
          onTabPress={() => onRouteTabPress("manage")}
          variant="manage"
        />

        <Tab
          isSelected={selectedTab === "activity"}
          onTabPress={() => onRouteTabPress("activity")}
          variant="activity"
        />
      </Box>

      <Box className={divider}>
        <Divider />
      </Box>
    </Box>
  );
};
