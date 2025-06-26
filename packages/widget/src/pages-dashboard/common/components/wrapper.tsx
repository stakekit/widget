import { Box } from "@sk-widget/components/atoms/box";
import { Header } from "@sk-widget/pages-dashboard/common/components/header";
import {
  outletWrapper,
  wrapper,
} from "@sk-widget/pages-dashboard/common/components/styles.css";
import { Tabs } from "@sk-widget/pages-dashboard/common/components/tabs";
import { PoweredBy } from "@sk-widget/pages/components/powered-by";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import { Outlet } from "react-router";

export const DashboardWrapper = () => {
  const { variant } = useSettings();

  return (
    <Box className={combineRecipeWithVariant({ rec: wrapper, variant })}>
      <Header />

      <Tabs />

      <Box
        className={combineRecipeWithVariant({ rec: outletWrapper, variant })}
      >
        <Outlet />
      </Box>

      <PoweredBy />
    </Box>
  );
};
