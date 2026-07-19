import { Outlet } from "react-router";
import { Header as DashboardHeader } from "../../features/widget-shell/dashboard/components/header";
import {
  outletWrapper as dashboardOutletWrapper,
  wrapper as dashboardWrapper,
} from "../../features/widget-shell/dashboard/components/styles.css";
import { PoweredBy } from "../../features/widget-shell/powered-by";
import { combineRecipeWithVariant } from "../../shared/styles/recipe-variant";
import { Box } from "../../shared/ui/primitives/box";
import { useWidgetConfig } from "../config/use-widget-config";
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
