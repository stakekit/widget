import { Option } from "effect";
import { useLocation } from "react-router";
import type { YieldCategory } from "../../../../domain/earn/contract";
import { useEarnYieldSelection } from "../../../../features/earn/index";
import { useWidgetNavigate } from "../../../../features/navigation/index";
import { useTrackEvent } from "../../../../features/tracking/index";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../services/navigation/widget-routes";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Divider } from "../../../../shared/ui/components/divider";
import { Box } from "../../../../shared/ui/primitives/box";
import { dashboardEarnRoute } from "../dashboard-earn-route";
import {
  divider,
  tabsContainer,
  tabsGroupDivider,
  tabsWrapper,
} from "./styles.css";
import { DashboardTab } from "./tab";

export type DashboardRouteTab = "earn" | "borrow" | "manage" | "activity";

/** The route tab a dashboard pathname belongs to. */
export const resolveDashboardRouteTab = (
  pathname: string
): DashboardRouteTab => {
  if (Option.isSome(widgetRoutes.activity.matchPrefix(pathname))) {
    return "activity";
  }
  if (Option.isSome(widgetRoutes.borrow.matchPrefix(pathname))) {
    return "borrow";
  }
  if (Option.isSome(widgetRoutes.positions.matchPrefix(pathname))) {
    return "manage";
  }
  return "earn";
};

const tabsMap: Record<DashboardRouteTab, WidgetPath> = {
  activity: widgetRoutes.activity.build(),
  borrow: widgetRoutes.borrow.build("Dashboard"),
  earn: widgetRoutes.earn.build(),
  manage: widgetRoutes.positions.build(),
};

export const DashboardTabs = ({
  pendingYieldCategory,
}: {
  /** A pressed yield category not yet applied to the Earn selection. */
  readonly pendingYieldCategory: YieldCategory | null;
}) => {
  const trackEvent = useTrackEvent();
  const navigation = useWidgetNavigate();
  const { view: yieldSelection } = useEarnYieldSelection();
  const availableYieldCategories = yieldSelection.availableCategories;
  const selectedYieldCategory =
    pendingYieldCategory ?? yieldSelection.selectedCategory;
  const selectedTab = resolveDashboardRouteTab(useLocation().pathname);

  const onRouteTabPress = (selected: DashboardRouteTab) => {
    if (selectedTab === selected) return;
    trackEvent("tabClicked", { selected });
    navigation.push(tabsMap[selected]);
  };

  const onYieldCategoryPress = (category: YieldCategory) => {
    if (selectedTab === "earn" && selectedYieldCategory === category) {
      return;
    }

    trackEvent("tabClicked", { selected: category });
    navigation.push(dashboardEarnRoute.build({ yieldCategory: category }));
  };

  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const variant = useWidgetConfig("variant");
  const categoryGroupingEnabled = useWidgetConfig("earnCategoryGrouping");
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
