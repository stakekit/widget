import type { ReactNode } from "react";
import type { DashboardYieldCategory } from "../../../domain/earn/contract";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import {
  DashboardHeader,
  PoweredBy,
} from "../../../features/widget-shell/composition";
import {
  dashboardOutletWrapper,
  dashboardWrapper,
} from "../../../features/widget-shell/views";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import { Box } from "../../../shared/ui/primitives/box";
import { DashboardTabs } from "./dashboard-tabs";

export const DashboardShell = ({
  children,
  onYieldCategorySelect,
  pendingYieldCategory,
}: {
  readonly children: ReactNode;
  readonly onYieldCategorySelect: (category: DashboardYieldCategory) => void;
  readonly pendingYieldCategory: DashboardYieldCategory | null;
}) => {
  const variant = useWidgetConfig("variant");

  return (
    <Box
      className={combineRecipeWithVariant({ rec: dashboardWrapper, variant })}
    >
      <DashboardHeader />
      <DashboardTabs
        onYieldCategorySelect={onYieldCategorySelect}
        pendingYieldCategory={pendingYieldCategory}
      />

      <Box
        className={combineRecipeWithVariant({
          rec: dashboardOutletWrapper,
          variant,
        })}
      >
        {children}
      </Box>

      <PoweredBy />
    </Box>
  );
};
