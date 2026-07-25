import { useAtomValue } from "@effect/atom-react";
import type { BorrowDashboardView } from "../model/borrow-form";
import { currentBorrowDashboardAtom } from "../state/form";
import { useBorrowConnectedWalletBridge } from "./use-borrow-wallet-bridge";

export const useBorrowDashboardView = (): BorrowDashboardView => {
  useBorrowConnectedWalletBridge();
  const view = useAtomValue(currentBorrowDashboardAtom);

  if (!view) {
    throw new Error("Borrow dashboard requires a connected borrow wallet");
  }

  return view;
};
