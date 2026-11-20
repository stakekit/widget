import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type { MarketId } from "../../../../domain/borrow/ids";
import { useWalletScopeRoute } from "../../../wallet/index";
import {
  BorrowPositionKey,
  borrowPositionViewAtom,
  retryBorrowPositionAtom,
} from "../state/positions";

/**
 * The market's position as the page presents it, and the command that loads
 * it again after a failure.
 */
export const useBorrowPosition = (marketId: MarketId | null | undefined) => {
  const key = new BorrowPositionKey({
    marketId: marketId ?? null,
    scope: useWalletScopeRoute(),
  });
  const position = useAtomValue(borrowPositionViewAtom(key));
  const retry = useAtomSet(retryBorrowPositionAtom(key));

  return { onRetry: () => retry(undefined), position } as const;
};
