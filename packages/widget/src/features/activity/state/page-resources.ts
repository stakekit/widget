import {
  type Cause,
  Data,
  Array as EArray,
  Effect,
  Option,
  Stream,
} from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { ActionStatus } from "../../../domain/action/rules";
import { getActivityActionCapabilities } from "../../../domain/activity/action-capabilities";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  type ActivityHistoryBatch,
  type ActivityHistoryError,
  ActivityHistoryKey,
  activityCountResourceAtom,
  activityHistoryPullAtom,
} from "../../../resources/activity-history/activity-history";
import { appRuntime } from "../../../runtime/app-runtime";
import { mapAsyncResultError } from "../../../shared/effect/async-result";
import { withPullPageDone } from "../../../shared/effect/pagination";
import type { ActivityActionItem } from "../model/activity-action";
import { projectActivityActionItem } from "../model/activity-enrichment";
import {
  type ActivityFeedFilter,
  type ActivityFilter,
  activityFilterCategories,
  getActivityFilterSources,
  projectActivityFilterOptions,
} from "../model/filters";
import {
  ActivityEnrichmentKey,
  activityEnrichmentFactsAtom,
} from "./enrichment";

const ACTIVITY_ACTION_STATUSES = Object.values(ActionStatus).filter(
  (status) => getActivityActionCapabilities(status).visibleInFeed
);

/** A feed's key: the Other filter reads the All feed, so it has none. */
export class ActivityActionsKey extends Data.Class<{
  readonly borrowEnabled: boolean;
  readonly filter: ActivityFeedFilter;
  readonly scope: WalletScopeKey | null;
}> {}

export const getActivityHistoryKey = (
  key: ActivityActionsKey
): ActivityHistoryKey | null => {
  const { includeBorrow, includeYield, yieldTypes } = getActivityFilterSources(
    key.filter,
    key.borrowEnabled
  );
  if (!key.scope || !(includeBorrow || includeYield)) return null;

  return new ActivityHistoryKey({
    includeBorrow,
    includeYield,
    scope: key.scope,
    statuses: ACTIVITY_ACTION_STATUSES,
    yieldTypes: yieldTypes ?? [],
  });
};

export const activityFilterAtom = Atom.make<ActivityFilter>("all").pipe(
  Atom.withLabel("activityFilterAtom")
);

type ActivityActionsBatch = Omit<ActivityHistoryBatch, "actions"> & {
  readonly actions: ReadonlyArray<ActivityActionItem>;
};

class ActivityActionsError extends Data.TaggedError("ActivityActionsError")<{
  readonly cause: ActivityHistoryError | Cause.NoSuchElementError;
}> {}

const toActivityActionsError = (
  cause: ActivityHistoryError | Cause.NoSuchElementError
) => new ActivityActionsError({ cause });

const emptyActivityActionsPullAtom = Atom.pull<
  ActivityActionsBatch,
  ActivityActionsError
>(
  Stream.succeed({
    actions: [],
    hasNextPage: false,
    total: 0,
  })
).pipe(withPullPageDone);

export const activityActionsPullAtom = Atom.family(
  (key: ActivityActionsKey) => {
    const historyKey = getActivityHistoryKey(key);
    if (!historyKey || !key.scope) return emptyActivityActionsPullAtom;

    const walletScope = key.scope;
    // The page shows its own error with a retry, so a failure raises no
    // global error sheet.
    const source = activityHistoryPullAtom.local(historyKey);

    return Atom.transform(
      source,
      (context): Atom.PullResult<ActivityActionsBatch, ActivityActionsError> =>
        AsyncResult.flatMap(
          mapAsyncResultError(context.get(source), toActivityActionsError),
          ({ done, items: batches }, historySuccess) => {
            // Each page enriches under its own key, so a new page enriches only
            // its own actions and never hides the pages already on screen.
            const enriched: Array<ActivityActionsBatch> = [];
            for (const batch of batches) {
              const factsResult = context.get(
                activityEnrichmentFactsAtom(
                  new ActivityEnrichmentKey(batch.actions)
                )
              );
              const facts = AsyncResult.value(factsResult);
              if (Option.isSome(facts)) {
                enriched.push({
                  ...batch,
                  actions: EArray.map(batch.actions, (entry) =>
                    projectActivityActionItem(entry, walletScope, facts.value)
                  ),
                });
                continue;
              }
              if (AsyncResult.isFailure(factsResult) && !factsResult.waiting) {
                return AsyncResult.failure(factsResult.cause, {
                  previousSuccess: EArray.isArrayNonEmpty(enriched)
                    ? Option.some(
                        AsyncResult.success({ done: false, items: enriched })
                      )
                    : Option.none(),
                });
              }
              break;
            }

            if (!EArray.isArrayNonEmpty(enriched)) {
              return AsyncResult.initial(true);
            }
            const enriching = enriched.length < batches.length;
            return AsyncResult.success(
              { done: done && !enriching, items: enriched },
              { waiting: historySuccess.waiting || enriching }
            );
          }
        )
    );
  }
);

export const loadMoreActivityActionsAtom = Atom.family(
  (key: ActivityActionsKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const resource = activityActionsPullAtom(key);
        const result = context(resource);
        const value = AsyncResult.value(result);

        if (result.waiting || value._tag !== "Some" || value.value.done) return;

        context.set(resource, undefined);
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("loadMoreActivityActionsAtom"))
);

export class ActivityFilterOptionsKey extends Data.Class<{
  readonly borrowEnabled: boolean;
  readonly scope: WalletScopeKey | null;
}> {}

export const activityFilterOptionsAtom = Atom.family(
  (key: ActivityFilterOptionsKey) =>
    appRuntime.atom((context) =>
      Effect.gen(function* () {
        if (!key.scope) return [];
        const scope = key.scope;
        const count = (filter: ActivityFeedFilter) => {
          const historyKey = getActivityHistoryKey(
            new ActivityActionsKey({
              borrowEnabled: key.borrowEnabled,
              filter,
              scope,
            })
          );

          return historyKey
            ? context.result(activityCountResourceAtom.local(historyKey))
            : Effect.succeed(0);
        };
        const allCount = yield* count("all");

        if (allCount <= 0) return [];

        const categoryCounts = yield* Effect.forEach(
          activityFilterCategories,
          (filter) =>
            count(filter).pipe(
              Effect.map((value) => ({ filter, count: value }))
            ),
          { concurrency: 3 }
        );

        return projectActivityFilterOptions({ allCount, categoryCounts });
      }).pipe(Effect.mapError(toActivityActionsError))
    )
);
