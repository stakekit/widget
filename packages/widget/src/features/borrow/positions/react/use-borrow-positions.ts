import { useAtomValue } from "@effect/atom-react";
import { useWalletScopeRoute } from "../../../wallet/ui";
import { useBorrowConnectedWalletBridge } from "../../wallet/react/use-borrow-wallet";
import { BorrowPositionKey, borrowPositionAtom } from "../state/positions";

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
