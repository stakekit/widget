import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  BorrowWalletBridgeState,
  BorrowWalletConnectedBridgeState,
} from "../../../services/borrow/wallet-state-projection";
import {
  currentBorrowWalletStateAtom,
  disconnectedBorrowWalletProjection,
} from "../wallet/atoms";

export const useBorrowWalletBridge = (): BorrowWalletBridgeState =>
  useAtomValue(currentBorrowWalletStateAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedBorrowWalletProjection)
  );

export const useBorrowConnectedWalletBridge =
  (): BorrowWalletConnectedBridgeState => {
    const walletBridge = useBorrowWalletBridge();

    if (walletBridge.status !== "connected") {
      throw new Error(
        "useBorrowConnectedWalletBridge requires a connected borrow wallet"
      );
    }

    return walletBridge;
  };
