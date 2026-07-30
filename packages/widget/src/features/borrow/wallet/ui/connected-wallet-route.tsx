import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { useBorrowWalletBridge } from "../react/use-borrow-wallet";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
