import { Match } from "effect";
import { startsWith } from "effect/String";
import { useNavigate } from "react-router";
import { isBorrowFeatureEnabled } from "../../../features/borrow/availability";
import { useEarnPageModel } from "../../../features/earn/ui/classic/earn-page/state/earn-page-model";
import { useTrackEvent } from "../../../features/tracking/react/use-track-event";
import { Divider } from "../../../features/widget-shell/divider";
import type { DashboardYieldCategory } from "../../../public-api/types";
import { useSKLocation } from "../../../shared/react/location-history";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import { Box } from "../../../shared/ui/primitives/box";
import { useWidgetConfig } from "../../config/use-widget-config";
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
  manage: "/manage",
};

export const DashboardTabs = () => {
  const trackEvent = useTrackEvent();
  const navigate = useNavigate();
  const {
    availableDashboardYieldCategories,
    onDashboardYieldCategorySelect,
    selectedDashboardYieldCategory,
  } = useEarnPageModel();
  const { current } = useSKLocation();

  const selectedTab = Match.value(current.pathname).pipe(
    Match.when(startsWith("/activity"), () => "activity" as const),
    Match.when(startsWith("/borrow"), () => "borrow" as const),
    Match.whenOr(
      startsWith("/manage"),
      startsWith("/positions"),
      () => "manage" as const
    ),
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
    onDashboardYieldCategorySelect(category);
    navigate("/");
  };

  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");
  const yieldGrouping = useWidgetConfig("yieldGrouping");
  const categoryGroupingEnabled = yieldGrouping === "category";
  const borrowFeatureEnabled = isBorrowFeatureEnabled({
    borrowEnabled,
    dashboardVariant,
    yieldGrouping,
  });
  const showGroupDivider =
    categoryGroupingEnabled &&
    (availableDashboardYieldCategories.length > 0 || borrowFeatureEnabled);

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

        {borrowFeatureEnabled ? (
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
