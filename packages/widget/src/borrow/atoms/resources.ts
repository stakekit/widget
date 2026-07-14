import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import type { WalletAddress } from "../../domain/schema/identifiers";
import { StakeKitApiService } from "../../providers/api/api-service";
import {
  type BorrowNetwork,
  deriveBorrowPositionItems,
  type MarketId,
  type Position,
} from "../domain";
import type { MissingBorrowApiClient } from "../runtime";
import { borrowAtomRuntime } from "../runtime";

export type BorrowAtomOperation =
  | "borrow-integrations"
  | "borrow-markets"
  | "borrow-position"
  | "borrow-positions";

export class BorrowAtomError extends Data.TaggedError("BorrowAtomError")<{
  readonly cause: unknown;
  readonly operation: BorrowAtomOperation;
}> {}

export class BorrowPositionNotFound extends Data.TaggedError(
  "BorrowPositionNotFound"
)<{
  readonly marketId: string;
}> {}

export type BorrowAtomResultError = BorrowAtomError | MissingBorrowApiClient;

export class BorrowMarketsKey extends Data.Class<{
  readonly network: BorrowNetwork;
}> {}

export class BorrowPositionsKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly network: BorrowNetwork | null;
}> {}

export class BorrowPositionKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly marketId: MarketId | string | null;
  readonly network: BorrowNetwork | null;
}> {}

const DEFAULT_PAGE_SIZE = 100;
const borrowSWR = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
  idleTTL: Duration.minutes(5),
  revalidateOnMount: true,
});

const withBorrowAtomError =
  (operation: BorrowAtomOperation) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.mapError(
        (cause) =>
          new BorrowAtomError({
            cause,
            operation,
          })
      )
    );

export const borrowIntegrationsAtom = borrowAtomRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = (yield* StakeKitApiService).borrow;
      return yield* api.getIntegrations();
    }).pipe(withBorrowAtomError("borrow-integrations"))
  )
  .pipe(borrowSWR);

export const borrowMarketsAtom = Atom.family((key: BorrowMarketsKey) =>
  borrowAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = (yield* StakeKitApiService).borrow;
        const page = yield* api.getMarkets({
          limit: DEFAULT_PAGE_SIZE,
          network: key.network,
          offset: 0,
          scope: "all",
        });

        return page.items ?? [];
      }).pipe(withBorrowAtomError("borrow-markets"))
    )
    .pipe(borrowSWR)
);

const loadBorrowPositions = ({
  address,
  network,
}: {
  readonly address: WalletAddress;
  readonly network: BorrowNetwork;
}) =>
  Effect.gen(function* () {
    const api = (yield* StakeKitApiService).borrow;
    const integrations = (yield* api.getIntegrations()).filter((integration) =>
      integration.networks.includes(network)
    );
    const marketsPage = yield* api.getMarkets({
      limit: DEFAULT_PAGE_SIZE,
      network,
      offset: 0,
      scope: "all",
    });
    const integrationPositions = yield* api.getPositionData({
      address,
      integrations,
      network,
    });

    return deriveBorrowPositionItems({
      integrationPositions,
      markets: marketsPage.items ?? [],
    });
  });

export const borrowPositionsAtom = Atom.family((key: BorrowPositionsKey) =>
  borrowAtomRuntime
    .atom(() => {
      if (!key.address || !key.network) {
        return Effect.succeed([] as Position[]);
      }

      return loadBorrowPositions({
        address: key.address,
        network: key.network,
      }).pipe(withBorrowAtomError("borrow-positions"));
    })
    .pipe(borrowSWR)
);

export const borrowPositionAtom = Atom.family((key: BorrowPositionKey) =>
  borrowAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.network || !key.marketId) {
          return yield* new BorrowPositionNotFound({
            marketId: key.marketId ?? "",
          });
        }

        const positions = yield* loadBorrowPositions({
          address: key.address,
          network: key.network,
        });
        const position = positions.find(
          (candidate) => candidate.id === key.marketId
        );

        if (!position) {
          return yield* new BorrowPositionNotFound({
            marketId: key.marketId,
          });
        }

        return position;
      }).pipe(withBorrowAtomError("borrow-position"))
    )
    .pipe(borrowSWR)
);
