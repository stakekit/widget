import { Outlet } from "react-router";
import {
  DashboardHeader,
  dashboardOutletWrapper,
  dashboardWrapper,
  PoweredBy,
} from "../../features/widget-shell";
import { combineRecipeWithVariant } from "../../shared/styles/recipe-variant";
import { Box } from "../../shared/ui/primitives/box";
import { useWidgetConfig } from "../config";
import { DashboardTabs } from "./dashboard-tabs";

export const DashboardShell = () => {
  const variant = useWidgetConfig("variant");

  return (
    <Box
      className={combineRecipeWithVariant({ rec: dashboardWrapper, variant })}
    >
      <DashboardHeader />
      <DashboardTabs />

      <Box
        className={combineRecipeWithVariant({
          rec: dashboardOutletWrapper,
          variant,
        })}
      >
        <Outlet />
      </Box>

      <PoweredBy />
    </Box>
  );
};
