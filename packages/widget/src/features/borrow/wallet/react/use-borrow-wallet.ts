import { useAtomValue } from "@effect/atom-react";
import type { BorrowWalletView } from "../model/wallet-view";
import { currentBorrowWalletViewAtom } from "../state/wallet";

export const useBorrowWalletView = (): BorrowWalletView =>
  useAtomValue(currentBorrowWalletViewAtom);
