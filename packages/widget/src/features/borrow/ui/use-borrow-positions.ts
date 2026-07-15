import { useAtomValue } from "@effect/atom-react";
import {
  BorrowPositionKey,
  BorrowPositionsKey,
  borrowPositionAtom,
  borrowPositionsAtom,
} from "../atoms/resources";
import {
  useBorrowConnectedWalletBridge,
  useBorrowWalletBridge,
} from "./wallet-bridge";

type BorrowPositionsOptions = {
  readonly enabled?: boolean;
};

export const useBorrowPositions = ({
  enabled = true,
}: BorrowPositionsOptions = {}) => {
  const walletBridge = useBorrowWalletBridge();
  const connectedWallet =
    enabled && walletBridge.status === "connected" ? walletBridge.wallet : null;
  const positionsResult = useAtomValue(
    borrowPositionsAtom(
      new BorrowPositionsKey({
        address: connectedWallet?.currentAccount.address ?? null,
        network: connectedWallet?.network ?? null,
      })
    )
  );

  return {
    positionsResult,
    walletBridge,
  };
};

export const useBorrowPosition = (marketId: string | null | undefined) => {
  const walletBridge = useBorrowConnectedWalletBridge();
  const wallet = walletBridge.wallet;
  const positionResult = useAtomValue(
    borrowPositionAtom(
      new BorrowPositionKey({
        address: wallet.currentAccount.address,
        marketId: marketId ?? null,
        network: wallet.network,
      })
    )
  );

  return {
    positionResult,
    walletBridge,
  };
};
