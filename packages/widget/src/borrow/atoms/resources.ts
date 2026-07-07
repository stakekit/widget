import { Data, Duration, Effect, flow, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { PositionDto } from "../../generated/api/borrow";
import {
  type BorrowNetwork,
  deriveBorrowPositionItems,
  Integration,
  Market,
  type MarketId,
  type Position,
} from "../domain";
import type { MissingBorrowApiClient } from "../runtime";
import { BorrowApiService, borrowAtomRuntime } from "../runtime";

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
  readonly address: string | null;
  readonly network: BorrowNetwork | null;
}> {}

export class BorrowPositionKey extends Data.Class<{
  readonly address: string | null;
  readonly marketId: MarketId | string | null;
  readonly network: BorrowNetwork | null;
}> {}

const DEFAULT_PAGE_SIZE = 100;
const PREFERRED_PAGE_CONCURRENCY = 5;

const borrowSWR = flow(
  Atom.swr({
    staleTime: Duration.minutes(1),
    revalidateOnMount: true,
  }),
  Atom.setIdleTTL(Duration.minutes(5))
);

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

const decodeIntegrations = Schema.decodeUnknownEffect(
  Schema.Array(Integration)
);
const decodeMarkets = Schema.decodeUnknownEffect(Schema.Array(Market));

export const borrowIntegrationsAtom = borrowAtomRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* BorrowApiService;
      const response =
        yield* api.IntegrationsControllerGetIntegrationsV1(undefined);

      return yield* decodeIntegrations(response);
    }).pipe(withBorrowAtomError("borrow-integrations"))
  )
  .pipe(borrowSWR);

export const borrowMarketsAtom = Atom.family((key: BorrowMarketsKey) =>
  borrowAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* BorrowApiService;
        const response = yield* api.MarketsControllerGetMarketsV1({
          params: {
            limit: DEFAULT_PAGE_SIZE,
            network: key.network,
            offset: 0,
            scope: "all",
          },
        });

        return yield* decodeMarkets(response.items ?? []);
      }).pipe(withBorrowAtomError("borrow-markets"))
    )
    .pipe(borrowSWR)
);

const loadBorrowPositions = ({
  address,
  network,
}: {
  readonly address: string;
  readonly network: BorrowNetwork;
}) =>
  Effect.gen(function* () {
    const api = yield* BorrowApiService;
    const integrationsResponse =
      yield* api.IntegrationsControllerGetIntegrationsV1(undefined);
    const integrations = (yield* decodeIntegrations(
      integrationsResponse
    )).filter((integration) => integration.networks.includes(network));
    const marketsResponse = yield* api.MarketsControllerGetMarketsV1({
      params: {
        limit: DEFAULT_PAGE_SIZE,
        network,
        offset: 0,
        scope: "all",
      },
    });
    const markets = yield* decodeMarkets(marketsResponse.items ?? []);
    const integrationPositions = yield* Effect.all(
      integrations.map((integration) =>
        Effect.gen(function* () {
          const position = yield* api.PositionsControllerGetPositionsV1({
            params: {
              address,
              integrationId: integration.id,
              network,
            },
          });

          return {
            integration,
            position: position as PositionDto,
          };
        })
      ),
      { concurrency: PREFERRED_PAGE_CONCURRENCY }
    );

    return deriveBorrowPositionItems({
      integrationPositions,
      markets,
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
