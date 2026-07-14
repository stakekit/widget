import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import {
  type BorrowWalletBridgeState,
  type BorrowWalletConnectedBridgeState,
  borrowExecutionRuntimeRefreshAtom,
  disconnectedBorrowWalletProjection,
  switchBorrowWalletChain,
  toBorrowSwitchChainCommandInput,
} from "../../borrow";
import { useSavedRef } from "../../hooks/use-saved-ref";
import {
  borrowWalletStateAtom,
  useWalletInitializationKey,
  walletStateAtom,
} from "../../providers/wallet";
import { disconnectedNormalizedWalletState } from "../../providers/wallet/state/wallet";

export const useBorrowWalletBridge = (): BorrowWalletBridgeState => {
  const initializationKey = useWalletInitializationKey();
  const walletProjection = useAtomValue(
    borrowWalletStateAtom(initializationKey)
  ).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedBorrowWalletProjection)
  );
  const walletState = useAtomValue(walletStateAtom(initializationKey)).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedNormalizedWalletState)
  );
  const latestWalletState = useSavedRef(walletState);

  return walletProjection.status === "connected"
    ? {
        ...walletProjection,
        switchChain: (chainId) =>
          switchBorrowWalletChain(
            toBorrowSwitchChainCommandInput({
              chainId,
              wallet: latestWalletState.current,
            })
          ),
      }
    : walletProjection;
};

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

export const BorrowConnectedWalletRoute = (): ReactNode => {
  useAtomMount(borrowExecutionRuntimeRefreshAtom);
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
