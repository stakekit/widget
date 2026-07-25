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

type BorrowPositionsOptions = {
  readonly enabled?: boolean;
};

export const useBorrowPositions = ({
  enabled = true,
}: BorrowPositionsOptions = {}) => {
  const walletBridge = useBorrowWalletBridge();
  const positionsResult = useAtomValue(currentBorrowPositionsAtom(enabled));

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
