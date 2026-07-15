import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  type BorrowWalletBridgeState,
  type BorrowWalletConnectedBridgeState,
  switchBorrowWalletChain,
  toBorrowSwitchChainCommandInput,
} from "../../../services/borrow/wallet-state-projection";
import { useSavedRef } from "../../../shared/react/use-saved-ref";
import {
  currentWalletStateResultAtom,
  disconnectedNormalizedWalletState,
} from "../../wallet";
import {
  currentBorrowWalletStateAtom,
  disconnectedBorrowWalletProjection,
} from "../wallet/atoms";

export const useBorrowWalletBridge = (): BorrowWalletBridgeState => {
  const walletProjection = useAtomValue(currentBorrowWalletStateAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedBorrowWalletProjection)
  );
  const walletState = useAtomValue(currentWalletStateResultAtom).pipe(
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
