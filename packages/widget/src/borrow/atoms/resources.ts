import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiResourcePolicy,
} from "../../atoms/api-resource";
import {
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
  type BorrowNetwork,
  deriveBorrowPositionItems,
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
      const api = yield* BorrowApiService;
      const response =
        yield* api.IntegrationsControllerGetIntegrationsV1(undefined);

      return yield* Schema.decodeUnknownEffect(BorrowIntegrationsResponse)(
        response
      );
    }).pipe(withBorrowAtomError("borrow-integrations"))
  )
  .pipe(borrowSWR);

export const borrowMarketsAtom = valueEqualAtomFamily((key: BorrowMarketsKey) =>
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

        const page = yield* Schema.decodeUnknownEffect(BorrowMarketsResponse)(
          response
        );

        return page.items ?? [];
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
    const integrations = (yield* Schema.decodeUnknownEffect(
      BorrowIntegrationsResponse
    )(integrationsResponse)).filter((integration) =>
      integration.networks.includes(network)
    );
    const marketsResponse = yield* api.MarketsControllerGetMarketsV1({
      params: {
        limit: DEFAULT_PAGE_SIZE,
        network,
        offset: 0,
        scope: "all",
      },
    });
    const marketsPage = yield* Schema.decodeUnknownEffect(
      BorrowMarketsResponse
    )(marketsResponse);
    const integrationPositionResponses = yield* Effect.all(
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
            position,
          };
        })
      ),
      { concurrency: PREFERRED_PAGE_CONCURRENCY }
    );
    const integrationPositions = yield* Schema.decodeUnknownEffect(
      BorrowIntegrationPositionsResponse
    )(integrationPositionResponses);

    return deriveBorrowPositionItems({
      integrationPositions,
      markets: marketsPage.items ?? [],
    });
  });

export const borrowPositionsAtom = valueEqualAtomFamily(
  (key: BorrowPositionsKey) =>
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

export const borrowPositionAtom = valueEqualAtomFamily(
  (key: BorrowPositionKey) =>
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
