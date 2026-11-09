import { Option } from "effect";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import type { YieldCategory } from "../../../../domain/earn/contract";
import { useEarnYieldSelection } from "../../../../features/earn/index";
import { useWidgetNavigate } from "../../../../features/navigation/index";
import { usePortfolioPendingActionsCount } from "../../../../features/portfolio/index";
import { useTrackEvent } from "../../../../features/tracking/index";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../services/navigation/widget-routes";
import { Box, type TabOption, Tabs } from "../../../../ui/index";
import { dashboardEarnRoute } from "../dashboard-earn-route";

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

/** A tab of the Dashboard Layout: a route tab or an Earn yield category. */
type DashboardTab = DashboardRouteTab | YieldCategory;

export const DashboardTabs = ({
  pendingYieldCategory,
  trailing,
}: {
  /** A pressed yield category not yet applied to the Earn selection. */
  readonly pendingYieldCategory: YieldCategory | null;
  /** Controls at the end of the tabs' row, such as the wallet header. */
  readonly trailing?: ReactNode;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const navigation = useWidgetNavigate();
  const pendingActionsCount = usePortfolioPendingActionsCount();
  const { view: yieldSelection } = useEarnYieldSelection();
  const availableYieldCategories = yieldSelection.availableCategories;
  const selectedYieldCategory =
    pendingYieldCategory ?? yieldSelection.selectedCategory;
  const selectedRouteTab = resolveDashboardRouteTab(useLocation().pathname);
  const borrowEnabled = useWidgetConfig("borrowEnabled");
  const categoryGroupingEnabled = useWidgetConfig("earnCategoryGrouping");
  const showGroupDivider =
    categoryGroupingEnabled &&
    (availableYieldCategories.length > 0 || borrowEnabled);

  const tabLabel = (tab: DashboardTab) =>
    t(`dashboard.details.tabs.${tab}`, tab);
  const earnTabs: ReadonlyArray<TabOption<DashboardTab>> =
    categoryGroupingEnabled
      ? availableYieldCategories.map((category) => ({
          value: category,
          label: tabLabel(category),
        }))
      : [{ value: "earn", label: tabLabel("earn") }];
  const tabs: ReadonlyArray<TabOption<DashboardTab>> = [
    ...earnTabs,
    ...(borrowEnabled
      ? [{ value: "borrow" as const, label: tabLabel("borrow") }]
      : []),
    {
      value: "manage",
      label: tabLabel("manage"),
      separated: showGroupDivider,
      count: pendingActionsCount,
      countLabel: t("positions.attention_count", {
        count: pendingActionsCount,
      }),
    },
    { value: "activity", label: tabLabel("activity") },
  ];
  const selectedTab: DashboardTab =
    categoryGroupingEnabled &&
    selectedRouteTab === "earn" &&
    selectedYieldCategory !== null
      ? selectedYieldCategory
      : selectedRouteTab;

  const onTabChange = (selected: DashboardTab) => {
    trackEvent("tabClicked", { selected });
    if (isDashboardRouteTab(selected)) {
      void navigation.push(tabsMap[selected]);
      return;
    }
    void navigation.push(dashboardEarnRoute.build({ yieldCategory: selected }));
  };

  return (
    <Box hostHook="tabs-section">
      <Tabs
        tabs={tabs}
        value={selectedTab}
        label={t("shared.widget_sections")}
        onValueChange={onTabChange}
        trailing={trailing}
      />
    </Box>
  );
};

const isDashboardRouteTab = (tab: DashboardTab): tab is DashboardRouteTab =>
  tab in tabsMap;
