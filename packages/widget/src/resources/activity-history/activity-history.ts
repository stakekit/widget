import {
  Data,
  DateTime,
  Duration,
  Array as EArray,
  Effect,
  Option,
  Stream,
} from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { YieldAction } from "../../domain/action/models";
import { isActivityActionOwnedByScope } from "../../domain/activity/action-capabilities";
import type { ActivityActionsQuery } from "../../domain/activity/query";
import type { ActionId as BorrowActionId } from "../../domain/borrow/ids";
import {
  type BorrowNetwork,
  isBorrowNetwork,
} from "../../domain/borrow/network";
import type { BorrowActivityAction } from "../../domain/borrow/responses";
import type { ActionId } from "../../domain/identity/identifiers";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import {
  BorrowResourceSource,
  YieldResourceSource,
} from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { getNextPageOffset } from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;

/** One Activity feed row, tagged by the API that owns it. */
export type ActivityHistoryEntry =
  | { readonly _tag: "yield"; readonly action: YieldAction }
  | {
      readonly _tag: "borrow";
      readonly action: BorrowActivityAction;
      readonly network: BorrowNetwork;
    };

export type BorrowActivityHistoryEntry = Extract<
  ActivityHistoryEntry,
  { readonly _tag: "borrow" }
>;

export class ActivityActionKey extends Data.TaggedClass("ActivityActionKey")<{
  readonly actionId: ActionId;
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: {
    readonly actionId: ActionId;
    readonly scope: WalletScopeKey;
  }) {
    super({
      actionId: input.actionId,
      scope: walletScopeOwnerKey(input.scope),
    });
  }
}

export type ActivityHistoryBatch = {
  readonly actions: ReadonlyArray<ActivityHistoryEntry>;
  readonly hasNextPage: boolean;
  readonly total: number;
};

type ActivityHistoryAttempt =
  | {
      readonly _tag: "page";
      readonly page: ActivityHistoryBatch;
    }
  | {
      readonly _tag: "failure";
      readonly error: ActivityHistoryError;
    };

/**
 * One Activity feed: Yield actions (optionally of some Yield types), Borrow
 * actions on the wallet network, or both. Callers decide whether Borrow is on.
 */
export class ActivityHistoryKey extends Data.TaggedClass("ActivityHistoryKey")<{
  readonly includeBorrow: boolean;
  readonly includeYield: boolean;
  readonly scope: WalletScopeOwnerKey;
  readonly statuses: ReadonlyArray<
    NonNullable<ActivityActionsQuery["statuses"]>[number]
  >;
  readonly yieldTypes: ReadonlyArray<
    NonNullable<ActivityActionsQuery["yieldTypes"]>[number]
  >;
}> {
  constructor(input: {
    readonly includeBorrow: boolean;
    readonly includeYield: boolean;
    readonly scope: WalletScopeKey;
    readonly statuses: ReadonlyArray<
      NonNullable<ActivityActionsQuery["statuses"]>[number]
    >;
    readonly yieldTypes?: ReadonlyArray<
      NonNullable<ActivityActionsQuery["yieldTypes"]>[number]
    >;
  }) {
    super({
      includeBorrow: input.includeBorrow,
      includeYield: input.includeYield,
      scope: walletScopeOwnerKey(input.scope),
      statuses: [...new Set(input.statuses)].sort(),
      yieldTypes: [...new Set(input.yieldTypes ?? [])].sort(),
    });
  }
}

export class ActivityHistoryError extends Data.TaggedError(
  "ActivityHistoryError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const activityPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

const activityActionCanonicalAtom = Atom.family((key: ActivityActionKey) =>
  appRuntime
    .atom(() =>
      YieldResourceSource.use((source) =>
        source.getActivityAction(key.actionId).pipe(
          Effect.map(
            Option.filter((action) =>
              isActivityActionOwnedByScope({
                action,
                scope: key.scope,
                yieldData: null,
              })
            )
          ),
          Effect.map(Option.getOrNull),
          Effect.mapError((cause) => new ActivityHistoryError({ cause }))
        )
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
      activityPolicy,
      Atom.withLabel("activityActionResourceAtom")
    )
);

export const activityActionResourceAtom = makePresentableResourceFamily(
  activityActionCanonicalAtom
);

export class BorrowActivityActionKey extends Data.TaggedClass(
  "BorrowActivityActionKey"
)<{
  readonly actionId: BorrowActionId;
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: {
    readonly actionId: BorrowActionId;
    readonly scope: WalletScopeKey;
  }) {
    super({
      actionId: input.actionId,
      scope: walletScopeOwnerKey(input.scope),
    });
  }
}

// Disabled or unconfigured Borrow has no actions to show, not a failure.
const borrowActivityActionCanonicalAtom = Atom.family(
  (key: BorrowActivityActionKey) =>
    appRuntime
      .atom(() => {
        const network = key.scope.network;
        if (!isBorrowNetwork(network)) {
          return Effect.succeed<BorrowActivityHistoryEntry | null>(null);
        }

        return BorrowResourceSource.use((source) =>
          source.getAction(key.actionId)
        ).pipe(
          Effect.map(
            // Owned: the wallet's address, and every transaction on its network.
            Option.filter(
              (action) =>
                sameWalletScopeOwner(
                  { address: action.address, network },
                  key.scope
                ) &&
                action.transactions.every(
                  (transaction) => transaction.network === network
                )
            )
          ),
          Effect.map(
            Option.match({
              onNone: (): BorrowActivityHistoryEntry | null => null,
              onSome: (action): BorrowActivityHistoryEntry => ({
                _tag: "borrow",
                action,
                network,
              }),
            })
          ),
          Effect.catchTags({
            BorrowFeatureDisabled: () => Effect.succeed(null),
            MissingBorrowApiConfig: () => Effect.succeed(null),
          }),
          Effect.mapError((cause) => new ActivityHistoryError({ cause }))
        );
      })
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
        activityPolicy,
        Atom.withLabel("borrowActivityActionResourceAtom")
      )
);

export const borrowActivityActionResourceAtom = makePresentableResourceFamily(
  borrowActivityActionCanonicalAtom
);

const activityRequest = (
  key: ActivityHistoryKey,
  pagination: { readonly limit: number; readonly offset: number }
): ActivityActionsQuery => ({
  address: key.scope.address,
  limit: pagination.limit,
  network: key.scope.network,
  offset: pagination.offset,
  statuses: key.statuses,
  ...(key.yieldTypes.length > 0 ? { yieldTypes: key.yieldTypes } : {}),
});

/** The only gate on Borrow requests: an opted-in feed on a Borrow network. */
const borrowNetworkOf = (key: ActivityHistoryKey): BorrowNetwork | null =>
  key.includeBorrow && isBorrowNetwork(key.scope.network)
    ? key.scope.network
    : null;

const listBorrowActions = (
  network: BorrowNetwork,
  key: ActivityHistoryKey,
  pagination: { readonly limit: number; readonly offset: number }
) =>
  BorrowResourceSource.use((source) =>
    source.listActions({
      address: key.scope.address,
      limit: pagination.limit,
      network,
      offset: pagination.offset,
      statuses: key.statuses,
    })
  );

type ActivityHistorySourcePage = {
  readonly entries: ReadonlyArray<ActivityHistoryEntry>;
  readonly nextOffset: Option.Option<number>;
  readonly total: number;
};

type ActivityHistorySourceCursor = {
  readonly buffered: ReadonlyArray<ActivityHistoryEntry>;
  readonly nextOffset: Option.Option<number>;
  /** Rows this source holds for the wallet scope. */
  readonly total: number;
};

type ActivityHistoryCursor = {
  readonly borrow: ActivityHistorySourceCursor;
  readonly yield: ActivityHistorySourceCursor;
};

const makeSourceCursor = (
  nextOffset: Option.Option<number>,
  total: number
): ActivityHistorySourceCursor => ({
  buffered: [],
  nextOffset,
  total,
});

const needsPage = (cursor: ActivityHistorySourceCursor) =>
  cursor.buffered.length === 0 && Option.isSome(cursor.nextOffset);

const fetchSourcePage = <E, R>(
  cursor: ActivityHistorySourceCursor,
  fetchPage: (offset: number) => Effect.Effect<ActivityHistorySourcePage, E, R>
): Effect.Effect<ActivityHistorySourceCursor, E, R> =>
  Option.isSome(cursor.nextOffset) && cursor.buffered.length === 0
    ? fetchPage(cursor.nextOffset.value).pipe(
        Effect.map((page) => ({
          buffered: page.entries,
          nextOffset: page.nextOffset,
          total: page.total,
        }))
      )
    : Effect.succeed(cursor);

const yieldSourcePage = (key: ActivityHistoryKey, offset: number) =>
  YieldResourceSource.use((source) =>
    source.listActivity(activityRequest(key, { limit: PAGE_SIZE, offset }))
  ).pipe(
    Effect.map(
      (page): ActivityHistorySourcePage => ({
        entries: (page.items ?? []).map((action) => ({
          _tag: "yield" as const,
          action,
        })),
        nextOffset: getNextPageOffset(page),
        total: page.total,
      })
    )
  );

// Borrow is optional: when it is unconfigured or failing, Activity stays Yield-only.
const fetchBorrowCursor = (
  key: ActivityHistoryKey,
  cursor: ActivityHistorySourceCursor
) => {
  const network = borrowNetworkOf(key);
  if (!network) return Effect.succeed(cursor);

  return fetchSourcePage(cursor, (offset) =>
    listBorrowActions(network, key, { limit: PAGE_SIZE, offset }).pipe(
      Effect.map(
        (page): ActivityHistorySourcePage => ({
          entries: (page.items ?? []).map((action) => ({
            _tag: "borrow" as const,
            action,
            network,
          })),
          nextOffset: getNextPageOffset(page),
          total: page.total,
        })
      )
    )
  ).pipe(
    Effect.orElseSucceed(() => ({ ...cursor, nextOffset: Option.none() }))
  );
};

/** Fetch until every source with more rows has buffered at least one. */
const fillActivityHistoryCursor = (
  key: ActivityHistoryKey,
  cursor: ActivityHistoryCursor
): Effect.Effect<
  ActivityHistoryCursor,
  ApiRequestError | ResponseDecodeError,
  YieldResourceSource | BorrowResourceSource
> =>
  needsPage(cursor.yield) || needsPage(cursor.borrow)
    ? Effect.all(
        {
          borrow: fetchBorrowCursor(key, cursor.borrow),
          yield: fetchSourcePage(cursor.yield, (offset) =>
            yieldSourcePage(key, offset)
          ),
        },
        { concurrency: "unbounded" }
      ).pipe(Effect.flatMap((next) => fillActivityHistoryCursor(key, next)))
    : Effect.succeed(cursor);

const entryCreatedAt = (entry: ActivityHistoryEntry) =>
  DateTime.toEpochMillis(entry.action.createdAt);

/**
 * Emit only rows no unfetched page can precede: everything at or after the
 * oldest buffered row of each source that still has pages.
 */
const takeMergedBatch = (
  cursor: ActivityHistoryCursor
): readonly [ActivityHistoryBatch, ActivityHistoryCursor] => {
  const cutoff = Math.max(
    Number.NEGATIVE_INFINITY,
    ...[cursor.yield, cursor.borrow].flatMap((source) =>
      Option.isSome(source.nextOffset)
        ? [Math.min(...source.buffered.map(entryCreatedAt))]
        : []
    )
  );
  const isEmitted = (entry: ActivityHistoryEntry) =>
    entryCreatedAt(entry) >= cutoff;
  const split = (source: ActivityHistorySourceCursor) => ({
    emitted: source.buffered.filter(isEmitted),
    next: {
      ...source,
      buffered: source.buffered.filter((entry) => !isEmitted(entry)),
    },
  });
  const yieldSplit = split(cursor.yield);
  const borrowSplit = split(cursor.borrow);
  const next = { borrow: borrowSplit.next, yield: yieldSplit.next };

  return [
    {
      actions: [...yieldSplit.emitted, ...borrowSplit.emitted].sort(
        (first, second) => entryCreatedAt(second) - entryCreatedAt(first)
      ),
      hasNextPage: [next.yield, next.borrow].some(
        (source) =>
          source.buffered.length > 0 || Option.isSome(source.nextOffset)
      ),
      total: next.yield.total + next.borrow.total,
    },
    next,
  ];
};

type ActivityHistoryStep = readonly [
  ReadonlyArray<ActivityHistoryAttempt>,
  Option.Option<ActivityHistoryCursor>,
];

const activityHistoryAttemptStream = (
  key: ActivityHistoryKey
): Stream.Stream<
  ActivityHistoryAttempt,
  never,
  YieldResourceSource | BorrowResourceSource
> =>
  Stream.paginate(
    {
      borrow: makeSourceCursor(
        borrowNetworkOf(key) ? Option.some(0) : Option.none(),
        0
      ),
      yield: makeSourceCursor(
        key.includeYield ? Option.some(0) : Option.none(),
        0
      ),
    } satisfies ActivityHistoryCursor,
    (cursor) =>
      fillActivityHistoryCursor(key, cursor).pipe(
        Effect.match({
          onFailure: (cause): ActivityHistoryStep => [
            [{ _tag: "failure", error: new ActivityHistoryError({ cause }) }],
            Option.some(cursor),
          ],
          onSuccess: (filled): ActivityHistoryStep => {
            const [page, next] = takeMergedBatch(filled);

            return [
              [{ _tag: "page", page }],
              page.hasNextPage ? Option.some(next) : Option.none(),
            ];
          },
        })
      )
  );

type ActivityHistoryPullValue = {
  readonly done: boolean;
  readonly items: EArray.NonEmptyArray<ActivityHistoryBatch>;
};

const projectActivityHistoryResult = (
  result: Atom.PullResult<ActivityHistoryAttempt>
): Atom.PullResult<ActivityHistoryBatch, ActivityHistoryError> =>
  AsyncResult.flatMap(result, ({ items }, sourceSuccess) => {
    const priorPages = items
      .slice(0, -1)
      .flatMap((attempt) => (attempt._tag === "page" ? [attempt.page] : []));
    const lastAttempt = EArray.lastNonEmpty(items);
    const projected: AsyncResult.AsyncResult<
      ActivityHistoryPullValue,
      ActivityHistoryError
    > =
      lastAttempt._tag === "failure"
        ? AsyncResult.failWithPrevious<
            ActivityHistoryPullValue,
            ActivityHistoryError
          >(lastAttempt.error, {
            previous: EArray.isArrayNonEmpty(priorPages)
              ? Option.some(
                  AsyncResult.success<
                    ActivityHistoryPullValue,
                    ActivityHistoryError
                  >({
                    done: false,
                    items: priorPages,
                  })
                )
              : Option.none(),
          })
        : AsyncResult.success<ActivityHistoryPullValue, ActivityHistoryError>({
            done: !lastAttempt.page.hasNextPage,
            items: EArray.append(priorPages, lastAttempt.page),
          });

    return sourceSuccess.waiting ? AsyncResult.waiting(projected) : projected;
  });

const borrowActivityCount = (key: ActivityHistoryKey) => {
  const network = borrowNetworkOf(key);
  if (!network) return Effect.succeed(0);

  return listBorrowActions(network, key, {
    limit: COUNT_PAGE_SIZE,
    offset: 0,
  }).pipe(
    Effect.map((page) => page.total),
    Effect.orElseSucceed(() => 0)
  );
};
const activityHistoryCanonicalPullAtom = Atom.family(
  (key: ActivityHistoryKey) => {
    const source = appRuntime.pull(() => activityHistoryAttemptStream(key));

    return Atom.transform(source, (context) =>
      projectActivityHistoryResult(context.get(source))
    ).pipe(
      Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
      activityPolicy,
      Atom.withLabel("activityHistoryPullAtom")
    );
  }
);

export const activityHistoryPullAtom = makePresentableResourceFamily(
  activityHistoryCanonicalPullAtom
);

const activityCountCanonicalAtom = Atom.family((key: ActivityHistoryKey) =>
  appRuntime
    .atom(() =>
      Effect.all(
        [
          key.includeYield
            ? YieldResourceSource.use((source) =>
                source.listActivity(
                  activityRequest(key, { limit: COUNT_PAGE_SIZE, offset: 0 })
                )
              ).pipe(Effect.map((page) => page.total))
            : Effect.succeed(0),
          borrowActivityCount(key),
        ],
        { concurrency: "unbounded" }
      ).pipe(
        Effect.map(([yieldCount, borrowCount]) => yieldCount + borrowCount),
        Effect.mapError((cause) => new ActivityHistoryError({ cause }))
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
      activityPolicy,
      Atom.withLabel("activityCountResourceAtom")
    )
);

export const activityCountResourceAtom = makePresentableResourceFamily(
  activityCountCanonicalAtom
);
