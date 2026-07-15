import { useAtomMount } from "@effect/atom-react";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { borrowExecutionRuntimeRefreshAtom } from "../atoms/refresh";
import { useBorrowWalletBridge } from "./wallet-bridge";

export {
  useBorrowConnectedWalletBridge,
  useBorrowWalletBridge,
} from "./wallet-bridge";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  useAtomMount(borrowExecutionRuntimeRefreshAtom);
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
