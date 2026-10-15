import { Data } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { MarketId } from "../../../../domain/borrow/ids";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import { widgetConfigAtom } from "../../../../features/widget-configuration/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/index";
import { walletScopeAtom } from "../../../wallet/index";

export class BorrowPositionKey extends Data.Class<{
  readonly marketId: MarketId | string | null;
  readonly scope: WalletScopeKey;
}> {}

export const borrowPositionAtom = Atom.family((key: BorrowPositionKey) => {
  const positionsAtom = borrowPositionsResourceAtom.foreground(
    new BorrowPositionsKey({ scope: key.scope })
  );

  return Atom.readable(
    (get) => {
      const positionsResult = get(positionsAtom);
      // A market with no balances has no position: after a full withdrawal
      // or repayment that is an outcome, not a failure.
      const detailResult = AsyncResult.map(
        positionsResult,
        (positions) =>
          positions.items.find((candidate) => candidate.id === key.marketId) ??
          null
      );

      return positionsResult.waiting
        ? AsyncResult.waiting(detailResult)
        : detailResult;
    },
    (refresh) => refresh(positionsAtom)
  );
});

export const currentBorrowPositionsAtom = Atom.make((get) => {
  const borrowEnabled = get(widgetConfigAtom).borrowEnabled;
  const scope = get(walletScopeAtom);

  return get(
    borrowPositionsResourceAtom.foreground(
      new BorrowPositionsKey({
        scope:
          borrowEnabled && scope && isBorrowNetwork(scope.network)
            ? scope
            : null,
      })
    )
  ).pipe(AsyncResult.map((positions) => positions.items));
}).pipe(Atom.withLabel("currentBorrowPositionsAtom"));
