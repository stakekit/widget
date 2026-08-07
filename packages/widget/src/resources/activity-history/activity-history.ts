import {
  Data,
  Duration,
  Array as EArray,
  Effect,
  Option,
  Stream,
} from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { ActivityActionsPage } from "../../domain/schema/activity-models";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { ActivityActionsQuery } from "../../domain/schema/legacy-models";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { getNextPageOffset } from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;
type ActivityAction = NonNullable<ActivityActionsPage["items"]>[number];

export type ActivityHistoryBatch = {
  readonly actions: ReadonlyArray<ActivityAction>;
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

const activityHistoryAttemptStream = (
  key: ActivityHistoryKey
): Stream.Stream<ActivityHistoryAttempt, never, YieldResourceSource> =>
  Stream.paginate(
    0,
    (
      offset
    ): Effect.Effect<
      readonly [ReadonlyArray<ActivityHistoryAttempt>, Option.Option<number>],
      never,
      YieldResourceSource
    > =>
      YieldResourceSource.use((source) =>
        source
          .listActivity(activityRequest(key, { limit: PAGE_SIZE, offset }))
          .pipe(
            Effect.matchEffect({
              onFailure: (cause) =>
                Effect.succeed([
                  [
                    {
                      _tag: "failure" as const,
                      error: new ActivityHistoryError({ cause }),
                    },
                  ],
                  Option.some(offset),
                ] as const),
              onSuccess: (page) => {
                const nextOffset = getNextPageOffset(page);

                return Effect.succeed([
                  [
                    {
                      _tag: "page" as const,
                      page: {
                        actions: page.items ?? [],
                        hasNextPage: Option.isSome(nextOffset),
                        total: page.total,
                      },
                    },
                  ],
                  nextOffset,
                ] as const);
              },
            })
          )
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
      YieldResourceSource.use((source) =>
        source
          .listActivity(
            activityRequest(key, { limit: COUNT_PAGE_SIZE, offset: 0 })
          )
          .pipe(
            Effect.map((page) => page.total),
            Effect.mapError((cause) => new ActivityHistoryError({ cause }))
          )
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
