import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import { WidgetNavigate } from "../../../navigation/views";
import { useBorrowWalletView } from "../react/use-borrow-wallet";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  const walletView = useBorrowWalletView();

  if (walletView.status === "ready") return <Outlet />;
  // A chain switch passes through connecting; keep the route until it settles.
  if (walletView.status === "connecting") {
    return <ContentLoaderSquare heightPx={340} />;
  }
  return <WidgetNavigate replace to={widgetRoutes.borrow.build("Dashboard")} />;
};
