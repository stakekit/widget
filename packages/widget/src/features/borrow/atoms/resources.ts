import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import {
  type BorrowIntegrationPositionsResponse,
  type BorrowNetwork,
  deriveBorrowPositionItems,
  isBorrowNetwork,
  type MarketId,
  type Position,
} from "../../../domain/borrow";
import { BorrowApiService } from "../../../services/api/borrow-api-service";
import { resourceInvalidationKeys } from "../../../services/resource-invalidation";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import { currentWalletScopeAtom } from "../../wallet";
import type { MissingBorrowApiClient } from "../runtime";

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
  readonly scope: WalletScopeKey | null;
}> {}

export class BorrowPositionKey extends Data.Class<{
  readonly marketId: MarketId | string | null;
  readonly scope: WalletScopeKey;
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

export const borrowIntegrationsAtom = appRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* BorrowApiService;
      return yield* api.getIntegrations();
    }).pipe(withBorrowAtomError("borrow-integrations"))
  )
  .pipe(borrowSWR);

export const borrowMarketsAtom = Atom.family((key: BorrowMarketsKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* BorrowApiService;
        const page = yield* api.getMarkets({
          limit: DEFAULT_PAGE_SIZE,
          network: key.network,
          offset: 0,
          scope: "all",
        });

        return page.items ?? [];
      }).pipe(withBorrowAtomError("borrow-markets"))
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.borrowMarkets(key.network)),
      borrowSWR
    )
);

const borrowPositionDataAtom = Atom.family((key: BorrowPositionsKey) =>
  appRuntime
    .atom((context) => {
      const network = key.scope?.network;
      if (!key.scope || !network || !isBorrowNetwork(network)) {
        return Effect.succeed(
          [] as typeof BorrowIntegrationPositionsResponse.Type
        );
      }
      const scope = key.scope;

      return Effect.gen(function* () {
        const allIntegrations = yield* context.result(borrowIntegrationsAtom);
        const integrations = allIntegrations.filter((integration) =>
          integration.networks.includes(network)
        );
        const api = yield* BorrowApiService;
        return yield* api
          .getPositionData({
            address: scope.address,
            integrations,
            network,
          })
          .pipe(withBorrowAtomError("borrow-positions"));
      });
    })
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.borrowPositions(key.scope)),
      borrowSWR
    )
);

export const borrowPositionsAtom = Atom.family((key: BorrowPositionsKey) => {
  const network = key.scope?.network;
  if (!key.scope || !network || !isBorrowNetwork(network)) {
    return Atom.make(AsyncResult.success([] as Position[]));
  }
  const positionDataAtom = borrowPositionDataAtom(key);
  const marketsAtom = borrowMarketsAtom(new BorrowMarketsKey({ network }));

  return Atom.readable(
    (get) =>
      AsyncResult.all({
        integrationPositions: get(positionDataAtom),
        markets: get(marketsAtom),
      }).pipe(
        AsyncResult.map(({ integrationPositions, markets }) =>
          deriveBorrowPositionItems({ integrationPositions, markets })
        )
      ),
    (refresh) => {
      refresh(positionDataAtom);
      refresh(marketsAtom);
    }
  );
});

export const borrowPositionAtom = Atom.family((key: BorrowPositionKey) => {
  const positionsAtom = borrowPositionsAtom(
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
      borrowPositionsAtom(
        new BorrowPositionsKey({
          scope:
            enabled && scope && isBorrowNetwork(scope.network) ? scope : null,
        })
      )
    );
  }).pipe(Atom.withLabel("currentBorrowPositionsAtom"))
);
