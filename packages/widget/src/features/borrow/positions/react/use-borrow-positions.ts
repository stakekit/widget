import { useAtomValue } from "@effect/atom-react";
import type { MarketId } from "../../../../domain/borrow/ids";
import { useWalletScopeRoute } from "../../../wallet/index";
import { BorrowPositionKey, borrowPositionAtom } from "../state/positions";

export const useBorrowPosition = (marketId: MarketId | null | undefined) => {
  const walletScope = useWalletScopeRoute();
  const positionResult = useAtomValue(
    borrowPositionAtom(
      new BorrowPositionKey({ marketId: marketId ?? null, scope: walletScope })
    )
  );

  return {
    positionResult,
  };
};
