import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../app/runtime/widget-config";
import type { MarketId } from "../../../../domain/borrow/ids";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import { borrowIntegrationsResourceAtom } from "../../../../resources/borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../../resources/borrow-markets/borrow-markets";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/borrow-positions";
import type { WalletScopeKey } from "../../../../services/wallet/wallet-scope";
import { walletScopeAtom } from "../../../wallet/state";

export { BorrowMarketsKey, BorrowPositionsKey };
export const borrowIntegrationsAtom = borrowIntegrationsResourceAtom.foreground;
export const borrowMarketsAtom = borrowMarketsResourceAtom.foreground;
export const borrowPositionsAtom = borrowPositionsResourceAtom.foreground;

export class BorrowPositionNotFound extends Data.TaggedError(
  "BorrowPositionNotFound"
)<{
  readonly marketId: string;
}> {}

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
      const detailResult = AsyncResult.flatMap(positionsResult, (positions) => {
        const position = key.marketId
          ? positions.items.find((candidate) => candidate.id === key.marketId)
          : null;

        return position
          ? AsyncResult.success(position)
          : AsyncResult.fail(
              new BorrowPositionNotFound({ marketId: key.marketId ?? "" })
            );
      });

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
