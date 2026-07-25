import { useAtomMount } from "@effect/atom-react";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { useBorrowWalletBridge } from "../react/use-borrow-wallet-bridge";
import { borrowTransactionFlowOutcomeBindingAtom } from "../state/transaction-flow-outcomes";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  useAtomMount(borrowTransactionFlowOutcomeBindingAtom);
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
