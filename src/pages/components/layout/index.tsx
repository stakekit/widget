import { Outlet } from "react-router-dom";
import { Box } from "../../../components/atoms/box";
import { Header } from "../../../components/molecules/header";

export const Layout = () => {
  return (
    <>
      <Box px="4" marginBottom="1">
        <Header />
      </Box>

      <Outlet />
    </>
  );
};
