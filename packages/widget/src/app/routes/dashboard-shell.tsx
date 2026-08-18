import { Outlet } from "react-router";
import { useWidgetConfig } from "../../features/widget-configuration/index";
import {
  DashboardHeader,
  PoweredBy,
} from "../../features/widget-shell/composition";
import {
  dashboardOutletWrapper,
  dashboardWrapper,
} from "../../features/widget-shell/views";
import { combineRecipeWithVariant } from "../../shared/styles/recipe-variant";
import { Box } from "../../shared/ui/primitives/box";
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
