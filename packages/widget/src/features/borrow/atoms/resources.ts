import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { MarketId } from "../../../domain/borrow/ids";
import { isBorrowNetwork } from "../../../domain/borrow/network";
import { BorrowResourceError } from "../../../resources/borrow/borrow-resource-error";
import { borrowIntegrationsResourceAtom } from "../../../resources/borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../resources/borrow-markets/borrow-markets";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../resources/borrow-positions/borrow-positions";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";
import type { MissingBorrowApiClient } from "../runtime";

export {
  BorrowMarketsKey,
  BorrowPositionsKey,
  BorrowResourceError as BorrowAtomError,
  borrowIntegrationsResourceAtom as borrowIntegrationsAtom,
  borrowMarketsResourceAtom as borrowMarketsAtom,
  borrowPositionsResourceAtom as borrowPositionsAtom,
};
export type BorrowAtomResultError =
  | BorrowResourceError
  | MissingBorrowApiClient;

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
  const positionsAtom = borrowPositionsResourceAtom(
    new BorrowPositionsKey({ scope: key.scope })
  );

  return Atom.readable(
    (get) => {
      const positionsResult = get(positionsAtom);
      const detailResult = AsyncResult.flatMap(positionsResult, (positions) => {
        const position = key.marketId
          ? positions.find((candidate) => candidate.id === key.marketId)
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

export const currentBorrowPositionsAtom = Atom.family((enabled: boolean) =>
  Atom.make((get) => {
    const scope = get(currentWalletScopeAtom);

    return get(
      borrowPositionsResourceAtom(
        new BorrowPositionsKey({
          scope:
            enabled && scope && isBorrowNetwork(scope.network) ? scope : null,
        })
      )
    );
  }).pipe(Atom.withLabel("currentBorrowPositionsAtom"))
);
