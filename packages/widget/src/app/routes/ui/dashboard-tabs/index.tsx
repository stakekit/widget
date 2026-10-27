import { Match } from "effect";
import { startsWith } from "effect/String";
import { useLocation, useNavigate } from "react-router";
import type { YieldCategory } from "../../../../domain/earn/contract";
import { useEarnYieldSelection } from "../../../../features/earn/index";
import { useTrackEvent } from "../../../../features/tracking/index";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Divider } from "../../../../shared/ui/components/divider";
import { Box } from "../../../../shared/ui/primitives/box";
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

export const DashboardTabs = ({
  onYieldCategorySelect,
  pendingYieldCategory,
}: {
  /** Selects a yield category; applying it may wait for the page transition. */
  readonly onYieldCategorySelect: (category: YieldCategory) => void;
  /** A pressed yield category not yet applied to the Earn selection. */
  readonly pendingYieldCategory: YieldCategory | null;
}) => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();
  const { view: yieldSelection } = useEarnYieldSelection();
  const availableYieldCategories = yieldSelection.availableCategories;
  const selectedYieldCategory =
    pendingYieldCategory ?? yieldSelection.selectedCategory;
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

  const onYieldCategoryPress = (category: YieldCategory) => {
    if (selectedTab === "earn" && selectedYieldCategory === category) {
      return;
    }

    trackEvent("tabClicked", { selected: category });
    onYieldCategorySelect(category);
    navigate("/");
  };

  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const variant = useWidgetConfig("variant");
  const yieldGrouping = useWidgetConfig("yieldGrouping");
  const categoryGroupingEnabled = yieldGrouping === "category";
  const showGroupDivider =
    categoryGroupingEnabled &&
    (availableYieldCategories.length > 0 || borrowEnabled);

  return (
    <Box className={combineRecipeWithVariant({ rec: tabsWrapper, variant })}>
      <Box
        className={combineRecipeWithVariant({ rec: tabsContainer, variant })}
        data-rk="tabs-section"
      >
        {categoryGroupingEnabled ? (
          availableYieldCategories.map((category) => (
            <DashboardTab
              isSelected={
                selectedTab === "earn" && selectedYieldCategory === category
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
