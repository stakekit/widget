import { useAtomValue } from "@effect/atom-react";
import { useBorrowConnectedWalletBridge } from "../../wallet/react/use-borrow-wallet";
import type { BorrowEntryView } from "../model/borrow-entry";
import { currentBorrowEntryAtom } from "../state/borrow-entry";

export const useBorrowEntryView = (): BorrowEntryView => {
  useBorrowConnectedWalletBridge();
  const view = useAtomValue(currentBorrowEntryAtom);

  if (!view) {
    throw new Error("Borrow Entry requires a connected borrow wallet");
  }

  return view;
};
