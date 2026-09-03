import { useAtomValue } from "@effect/atom-react";
import { useWalletScopeRoute } from "../../../wallet/index";
import { BorrowPositionKey, borrowPositionAtom } from "../state/positions";

export const useBorrowPosition = (marketId: string | null | undefined) => {
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
