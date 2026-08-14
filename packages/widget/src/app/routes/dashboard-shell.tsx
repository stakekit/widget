import { Outlet } from "react-router";
import {
  dashboardOutletWrapper,
  dashboardWrapper,
} from "../../features/widget-shell/components";
import { DashboardHeader, PoweredBy } from "../../features/widget-shell/ui";
import { combineRecipeWithVariant } from "../../shared/styles/recipe-variant";
import { Box } from "../../shared/ui/primitives/box";
import { useWidgetConfig } from "../composition/use-widget-config";
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
