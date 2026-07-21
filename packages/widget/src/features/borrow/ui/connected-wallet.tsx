import { useAtomMount } from "@effect/atom-react";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { borrowTransactionFlowOutcomeBindingAtom } from "../atoms/transaction-flow-outcomes";
import { useBorrowWalletBridge } from "./wallet-bridge";

export const BorrowConnectedWalletRoute = (): ReactNode => {
  useAtomMount(borrowTransactionFlowOutcomeBindingAtom);
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
