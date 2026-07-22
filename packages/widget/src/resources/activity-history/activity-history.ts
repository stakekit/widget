import { Data, Duration, Effect, Stream } from "effect";
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
import {
  paginatedApiStream,
  withPullPageDone,
} from "../../shared/effect/pagination";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;
type ActivityAction = NonNullable<ActivityActionsPage["items"]>[number];

export type ActivityHistoryBatch = {
  readonly actions: ReadonlyArray<ActivityAction>;
  readonly hasNextPage: boolean;
  readonly total: number;
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
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
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

export const activityHistoryPullAtom = Atom.family((key: ActivityHistoryKey) =>
  appRuntime
    .pull(() =>
      paginatedApiStream<
        ActivityAction,
        ApiRequestError | ResponseDecodeError,
        YieldResourceSource,
        ActivityHistoryBatch
      >({
        fetchPage: (offset) =>
          YieldResourceSource.use((source) =>
            source
              .listActivity(activityRequest(key, { limit: PAGE_SIZE, offset }))
              .pipe(
                Effect.map((page) => ({ ...page, items: page.items ?? [] }))
              )
          ),
        mapPage: (page, hasNextPage) => ({
          actions: page.items,
          hasNextPage,
          total: page.total,
        }),
      }).pipe(Stream.mapError((cause) => new ActivityHistoryError({ cause })))
    )
    .pipe(
      withPullPageDone,
      Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
      activityPolicy,
      Atom.withLabel("activityHistoryPullAtom")
    )
);

export const activityCountResourceAtom = Atom.family(
  (key: ActivityHistoryKey) =>
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
