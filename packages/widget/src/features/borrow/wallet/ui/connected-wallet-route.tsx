import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { useBorrowWalletView } from "../react/use-borrow-wallet";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  const walletView = useBorrowWalletView();

  return walletView.status === "ready" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
