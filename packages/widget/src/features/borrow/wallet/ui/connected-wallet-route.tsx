import type { ReactNode } from "react";
import { Outlet } from "react-router";

import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { Skeleton, Stack } from "../../../../ui/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useBorrowWalletView } from "./use-borrow-wallet";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  const walletView = useBorrowWalletView();

  if (walletView.status === "ready") return <Outlet />;
  // A chain switch passes through connecting; keep the route until it settles.
  if (walletView.status === "connecting") {
    return (
      <Stack gap={8} aria-busy>
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
      </Stack>
    );
  }
  return <WidgetNavigate replace to={widgetRoutes.borrow.build("Dashboard")} />;
};
