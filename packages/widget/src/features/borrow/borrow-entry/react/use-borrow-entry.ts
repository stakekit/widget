import { useAtomValue } from "@effect/atom-react";
import type { BorrowEntryView } from "../model/borrow-entry";
import { currentBorrowEntryAtom } from "../state/borrow-entry";

export const useBorrowEntryView = (): BorrowEntryView => {
  const view = useAtomValue(currentBorrowEntryAtom);

  if (!view) {
    throw new Error("Borrow Entry requires a connected borrow wallet");
  }

  return view;
};
