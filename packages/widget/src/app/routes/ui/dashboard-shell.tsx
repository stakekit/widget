import { useState } from "react";
import { Outlet, useOutletContext } from "react-router";
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

type DashboardShellContext = {
  /** Bumped on each yield category tab press that changes the category. */
  readonly categoryTransition: number;
};

export const useDashboardCategoryTransition = () =>
  useOutletContext<DashboardShellContext>().categoryTransition;

export const DashboardShell = () => {
  const variant = useWidgetConfig("variant");
  const [categoryTransition, setCategoryTransition] = useState(0);

  return (
    <Box
      className={combineRecipeWithVariant({ rec: dashboardWrapper, variant })}
    >
      <DashboardHeader />
      <DashboardTabs
        onYieldCategoryChange={() => setCategoryTransition((n) => n + 1)}
      />

      <Box
        className={combineRecipeWithVariant({
          rec: dashboardOutletWrapper,
          variant,
        })}
      >
        <Outlet
          context={{ categoryTransition } satisfies DashboardShellContext}
        />
      </Box>

      <PoweredBy />
    </Box>
  );
};
