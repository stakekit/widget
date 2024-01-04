import { Outlet, ScrollRestoration } from "react-router-dom";
import { Box } from "../../../components/atoms/box";
import { Header } from "../../../components/molecules/header";
import { useLocationTransition } from "../../../providers/location-transition";

export const Layout = () => {
  const { location, displayLocation } = useLocationTransition();

  return (
    <>
      {location === displayLocation && <ScrollRestoration />}
      <Box px="4" marginBottom="1">
        <Header />
      </Box>

      <Outlet />
    </>
  );
};
