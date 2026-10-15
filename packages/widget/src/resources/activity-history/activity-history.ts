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
import type {
  BorrowActionsPage,
  BorrowActivityAction,
} from "../../domain/borrow/responses";
import type { ActionId } from "../../domain/identity/identifiers";
import {
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
import {
  API_MAX_PAGE_SIZE,
  getNextPageOffset,
  loadAllPages,
} from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;
const BORROW_COUNT_CONCURRENCY = 3;

/** One Activity feed row, tagged by the API that owns it. */
export type ActivityHistoryEntry =
  | { readonly _tag: "yield"; readonly action: YieldAction }
  | { readonly _tag: "borrow"; readonly action: BorrowActivityAction };

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

export class ActivityHistoryKey extends Data.TaggedClass("ActivityHistoryKey")<{
  readonly scope: WalletScopeOwnerKey;
  readonly statuses: ReadonlyArray<
    NonNullable<ActivityActionsQuery["statuses"]>[number]
  >;
  readonly yieldTypes: ReadonlyArray<
    NonNullable<ActivityActionsQuery["yieldTypes"]>[number]
  >;
}> {
  constructor(input: {
    readonly scope: WalletScopeKey;
    readonly statuses: ReadonlyArray<
      NonNullable<ActivityActionsQuery["statuses"]>[number]
    >;
    readonly yieldTypes?: ReadonlyArray<
      NonNullable<ActivityActionsQuery["yieldTypes"]>[number]
    >;
  }) {
    super({
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

/**
 * Borrow actions stay disconnected until the Borrow API filters `/v1/actions`
 * by network; until then the feed would have to load and filter every page.
 */
const borrowActivityConnected = false;

/** Borrow has no Yield type, so only the unfiltered feed includes it. */
const includesBorrow = (key: ActivityHistoryKey) =>
  borrowActivityConnected && key.yieldTypes.length === 0;

const listBorrowActions = (
  key: ActivityHistoryKey,
  pagination: { readonly limit: number; readonly offset: number }
) =>
  BorrowResourceSource.use((source) =>
    source.listActions({
      address: key.scope.address,
      limit: pagination.limit,
      offset: pagination.offset,
      statuses: key.statuses,
    })
  );

// The Borrow API cannot filter by network; actions carry their chain on each transaction.
const isBorrowActionOnScopeNetwork = (
  key: ActivityHistoryKey,
  action: BorrowActivityAction
) =>
  action.transactions.some(
    (transaction) => transaction.network === key.scope.network
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

// A Borrow page total spans every network, so the cursor keeps the scoped count.
const projectBorrowSourcePage = (
  key: ActivityHistoryKey,
  page: BorrowActionsPage,
  scopedTotal: number
): ActivityHistorySourcePage => ({
  entries: (page.items ?? []).flatMap((action) =>
    isBorrowActionOnScopeNetwork(key, action)
      ? [{ _tag: "borrow" as const, action }]
      : []
  ),
  nextOffset: getNextPageOffset(page),
  total: scopedTotal,
});

// Borrow is optional: when it is unconfigured or failing, Activity stays Yield-only.
const fetchBorrowCursor = (
  key: ActivityHistoryKey,
  cursor: ActivityHistorySourceCursor
) =>
  fetchSourcePage(cursor, (offset) =>
    listBorrowActions(key, { limit: PAGE_SIZE, offset }).pipe(
      Effect.map((page) => projectBorrowSourcePage(key, page, cursor.total))
    )
  ).pipe(
    Effect.orElseSucceed(() => ({ ...cursor, nextOffset: Option.none() }))
  );

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
  key: ActivityHistoryKey,
  borrowTotal: number
): Stream.Stream<
  ActivityHistoryAttempt,
  never,
  YieldResourceSource | BorrowResourceSource
> =>
  Stream.paginate(
    {
      borrow: makeSourceCursor(
        includesBorrow(key) ? Option.some(0) : Option.none(),
        borrowTotal
      ),
      yield: makeSourceCursor(Option.some(0), 0),
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

// Borrow totals span every network, so its count needs the scoped rows.
const borrowActivityCount = (key: ActivityHistoryKey) =>
  includesBorrow(key)
    ? loadAllPages({
        concurrency: BORROW_COUNT_CONCURRENCY,
        fetchPage: (offset) =>
          listBorrowActions(key, { limit: API_MAX_PAGE_SIZE, offset }),
        pageSize: API_MAX_PAGE_SIZE,
      }).pipe(
        Effect.map(
          (actions) =>
            actions.filter((action) =>
              isBorrowActionOnScopeNetwork(key, action)
            ).length
        ),
        Effect.orElseSucceed(() => 0)
      )
    : Effect.succeed(0);

const borrowActivityCountAtom = Atom.family((key: ActivityHistoryKey) =>
  appRuntime
    .atom(() => borrowActivityCount(key))
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
      activityPolicy,
      Atom.withLabel("borrowActivityCountAtom")
    )
);

const activityHistoryCanonicalPullAtom = Atom.family(
  (key: ActivityHistoryKey) => {
    const source = appRuntime.pull((get) =>
      Stream.unwrap(
        get
          .result(borrowActivityCountAtom(key))
          .pipe(
            Effect.map((borrowTotal) =>
              activityHistoryAttemptStream(key, borrowTotal)
            )
          )
      )
    );

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
    .atom((context) =>
      Effect.all(
        [
          YieldResourceSource.use((source) =>
            source.listActivity(
              activityRequest(key, { limit: COUNT_PAGE_SIZE, offset: 0 })
            )
          ).pipe(Effect.map((page) => page.total)),
          context.result(borrowActivityCountAtom(key)),
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
