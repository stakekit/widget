import { useAtomValue } from "@effect/atom-react";

import type { MarketId } from "../../../../domain/borrow/ids";
import { useWalletScopeRoute } from "../../../wallet/index";
import { BorrowPositionKey, borrowPositionViewAtom } from "../state/positions";

/** The market's position as the page presents it. */
export const useBorrowPosition = (marketId: MarketId | null | undefined) =>
  useAtomValue(
    borrowPositionViewAtom(
      new BorrowPositionKey({
        marketId: marketId ?? null,
        scope: useWalletScopeRoute(),
      })
    )
  );
