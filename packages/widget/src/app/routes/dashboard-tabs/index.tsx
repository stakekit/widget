import { Match } from "effect";
import { startsWith } from "effect/String";
import { useLocation, useNavigate } from "react-router";
import { useEarnYieldSelection } from "../../../features/earn/state";
import { useTrackEvent } from "../../../features/tracking/state";
import type { DashboardYieldCategory } from "../../../public-api/types";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import { Divider } from "../../../shared/ui/components/divider";
import { Box } from "../../../shared/ui/primitives/box";
import { useWidgetConfig } from "../../composition/use-widget-config";
import {
  divider,
  tabsContainer,
  tabsGroupDivider,
  tabsWrapper,
} from "./styles.css";
import { DashboardTab } from "./tab";

type RouteTab = "earn" | "borrow" | "manage" | "activity";

const tabsMap: Record<RouteTab, string> = {
  activity: "/activity",
  borrow: "/borrow",
  earn: "/",
  manage: "/positions",
};

export const DashboardTabs = () => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();
  const { selectCategory, view: yieldSelection } = useEarnYieldSelection();
  const availableDashboardYieldCategories = yieldSelection.availableCategories;
  const selectedDashboardYieldCategory = yieldSelection.selectedCategory;
  const location = useLocation();

  const selectedTab = Match.value(location.pathname).pipe(
    Match.when(startsWith("/activity"), () => "activity" as const),
    Match.when(startsWith("/borrow"), () => "borrow" as const),
    Match.when(startsWith("/positions"), () => "manage" as const),
    Match.orElse(() => "earn" as const)
  );

  const onRouteTabPress = (selected: RouteTab) => {
    if (selectedTab === selected) return;
    trackEvent("tabClicked", { selected });
    navigate(tabsMap[selected]);
  };

  const onYieldCategoryPress = (category: DashboardYieldCategory) => {
    if (selectedTab === "earn" && selectedDashboardYieldCategory === category) {
      return;
    }

    trackEvent("tabClicked", { selected: category });
    selectCategory(category);
    navigate("/");
  };

  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const variant = useWidgetConfig("variant");
  const yieldGrouping = useWidgetConfig("yieldGrouping");
  const categoryGroupingEnabled = yieldGrouping === "category";
  const showGroupDivider =
    categoryGroupingEnabled &&
    (availableDashboardYieldCategories.length > 0 || borrowEnabled);

  return (
    <Box className={combineRecipeWithVariant({ rec: tabsWrapper, variant })}>
      <Box
        className={combineRecipeWithVariant({ rec: tabsContainer, variant })}
        data-rk="tabs-section"
      >
        {categoryGroupingEnabled ? (
          availableDashboardYieldCategories.map((category) => (
            <DashboardTab
              isSelected={
                selectedTab === "earn" &&
                selectedDashboardYieldCategory === category
              }
              key={category}
              onTabPress={() => onYieldCategoryPress(category)}
              variant={category}
            />
          ))
        ) : (
          <DashboardTab
            isSelected={selectedTab === "earn"}
            onTabPress={() => onRouteTabPress("earn")}
            variant="earn"
          />
        )}

        {borrowEnabled ? (
          <DashboardTab
            isSelected={selectedTab === "borrow"}
            onTabPress={() => onRouteTabPress("borrow")}
            variant="borrow"
          />
        ) : null}

        {showGroupDivider ? <Box className={tabsGroupDivider} /> : null}

        <DashboardTab
          isSelected={selectedTab === "manage"}
          onTabPress={() => onRouteTabPress("manage")}
          variant="manage"
        />
        <DashboardTab
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
