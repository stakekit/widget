import { Outlet } from "react-router";
import { Box } from "../../../components/atoms/box";
import { PoweredBy } from "../../../pages/components/powered-by";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Header } from "./header";
import { outletWrapper, wrapper } from "./styles.css";
import { Tabs } from "./tabs";

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
