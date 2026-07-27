import { useAtomValue } from "@effect/atom-react";
import { useWalletScopeRoute } from "../../wallet/ui";
import {
  BorrowPositionKey,
  borrowPositionAtom,
  currentBorrowPositionsAtom,
} from "../state/resources";
import {
  useBorrowConnectedWalletBridge,
  useBorrowWalletBridge,
} from "./use-borrow-wallet-bridge";

export const useBorrowPositions = () => {
  const walletBridge = useBorrowWalletBridge();
  const positionsResult = useAtomValue(currentBorrowPositionsAtom);

  return {
    positionsResult,
    walletBridge,
  };
};

export const useBorrowPosition = (marketId: string | null | undefined) => {
  const walletBridge = useBorrowConnectedWalletBridge();
  const walletScope = useWalletScopeRoute();
  const positionResult = useAtomValue(
    borrowPositionAtom(
      new BorrowPositionKey({ marketId: marketId ?? null, scope: walletScope })
    )
  );

  return {
    positionResult,
    walletBridge,
  };
};
