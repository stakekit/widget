import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { MarketId } from "../../../../domain/borrow/ids";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import { widgetConfigAtom } from "../../../../features/widget-configuration/index";
import { borrowIntegrationsResourceAtom } from "../../../../resources/borrow-integrations/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../../resources/borrow-markets/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/index";
import type { WalletScopeKey } from "../../../../services/wallet/wallet-scope";
import { walletScopeAtom } from "../../../wallet/index";

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
