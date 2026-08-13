import { type Cause, Data, Array as EArray, Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { getActionValidatorAddresses } from "../../../../domain/action/rules";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import type {
  ValidatorAddress,
  YieldId,
} from "../../../../domain/identity/identifiers";
import {
  type ActivityHistoryBatch,
  type ActivityHistoryError,
  activityCountResourceAtom,
  activityHistoryPullAtom,
} from "../../../../resources/activity-history/activity-history";
import {
  ValidatorByAddressKey,
  validatorByAddressAtom,
} from "../../../../resources/validator-directory/validator-directory";
import { enrichedYieldOpportunityResourceAtom } from "../../../../resources/yield-opportunity/yield-opportunity";
import type { WalletScopeKey } from "../../../../services/wallet/wallet-scope";
import { mapAsyncResultError } from "../../../../shared/effect/async-result";
import { withPullPageDone } from "../../../../shared/effect/pagination";
import type { ActivityActionItem } from "../../model/activity-action";
import {
  type ActivityFilter,
  activityFilterCategories,
} from "../../model/filters";
import { ActivityActionsKey, getActivityHistoryKey } from "./activity-request";

type ActivityAction = ActivityHistoryBatch["actions"][number];

type ActivityActionsBatch = Omit<ActivityHistoryBatch, "actions"> & {
  readonly actions: ReadonlyArray<ActivityActionItem>;
};

const ACTIVITY_ENRICHMENT_CONCURRENCY = 5;

const validatorFactKey = ({
  address,
  yieldId,
}: {
  readonly address: ValidatorAddress;
  readonly yieldId: YieldId;
}) => JSON.stringify([yieldId, address]);

class ActivityEnrichmentKey extends Data.Class<{
  readonly validatorKeys: ReadonlyArray<ValidatorByAddressKey>;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(actions: ReadonlyArray<ActivityAction>) {
    const validatorKeys = new Map<string, ValidatorByAddressKey>();

    for (const action of actions) {
      for (const address of getActionValidatorAddresses(action) ?? []) {
        const key = new ValidatorByAddressKey({
          address,
          yieldId: action.yieldId,
        });
        validatorKeys.set(validatorFactKey(key), key);
      }
    }

    super({
      validatorKeys: [...validatorKeys.values()].sort((first, second) =>
        validatorFactKey(first).localeCompare(validatorFactKey(second))
      ),
      yieldIds: [...new Set(actions.map((action) => action.yieldId))].sort(),
    });
  }
}

type ActivityEnrichmentFacts = {
  readonly validatorsByKey: ReadonlyMap<string, EarnValidator>;
  readonly yieldsById: ReadonlyMap<YieldId, EarnYieldWithProvider | null>;
};

type ActivityEnrichmentFact =
  | {
      readonly _tag: "validator";
      readonly key: ValidatorByAddressKey;
      readonly value: EarnValidator | null;
    }
  | {
      readonly _tag: "yield";
      readonly value: EarnYieldWithProvider | null;
      readonly yieldId: YieldId;
    };

const activityEnrichmentFactsAtom = Atom.family((key: ActivityEnrichmentKey) =>
  appRuntime
    .atom((context) => {
      const requests = [
        ...key.yieldIds.map((yieldId) => ({ _tag: "yield" as const, yieldId })),
        ...key.validatorKeys.map((validatorKey) => ({
          _tag: "validator" as const,
          validatorKey,
        })),
      ];

      return Effect.forEach(
        requests,
        (request): Effect.Effect<ActivityEnrichmentFact> =>
          request._tag === "yield"
            ? context
                .resultOnce(
                  enrichedYieldOpportunityResourceAtom.local(request.yieldId)
                )
                .pipe(
                  Effect.catchCause(() => Effect.succeed(null)),
                  Effect.map((value) => ({
                    _tag: "yield" as const,
                    value,
                    yieldId: request.yieldId,
                  }))
                )
            : context
                .resultOnce(validatorByAddressAtom.local(request.validatorKey))
                .pipe(
                  Effect.catchCause(() => Effect.succeed(null)),
                  Effect.map((value) => ({
                    _tag: "validator" as const,
                    key: request.validatorKey,
                    value,
                  }))
                ),
        { concurrency: ACTIVITY_ENRICHMENT_CONCURRENCY }
      ).pipe(
        Effect.map((facts): ActivityEnrichmentFacts => {
          const validatorsByKey = new Map<string, EarnValidator>();
          const yieldsById = new Map<YieldId, EarnYieldWithProvider | null>();

          for (const fact of facts) {
            if (fact._tag === "yield") {
              yieldsById.set(fact.yieldId, fact.value);
            } else if (fact.value) {
              validatorsByKey.set(validatorFactKey(fact.key), fact.value);
            }
          }

          return { validatorsByKey, yieldsById };
        })
      );
    })
    .pipe(Atom.withLabel("activityEnrichmentFactsAtom"))
);

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
    const source = activityHistoryPullAtom.foreground(historyKey);

    return Atom.transform(source, (context) => {
      const historyResult = mapAsyncResultError(
        context.get(source),
        toActivityActionsError
      );

      return AsyncResult.flatMap(
        historyResult,
        ({ done, items: batches }, historySuccess) => {
          const actions = EArray.flatMap(batches, (batch) => batch.actions);
          const enrichmentResult = context.get(
            activityEnrichmentFactsAtom(new ActivityEnrichmentKey(actions))
          );
          const projected = enrichmentResult.pipe(
            AsyncResult.map(({ validatorsByKey, yieldsById }) => ({
              done,
              items: EArray.map(batches, (batch) => ({
                ...batch,
                actions: EArray.map(batch.actions, (action) => ({
                  actionData: action,
                  validatorsData: EArray.flatMap(
                    getActionValidatorAddresses(action) ?? [],
                    (address) => {
                      const validator = validatorsByKey.get(
                        validatorFactKey({ address, yieldId: action.yieldId })
                      );

                      return validator ? [validator] : [];
                    }
                  ),
                  walletScope,
                  yieldData: yieldsById.get(action.yieldId) ?? null,
                })),
              })),
            }))
          );

          return historySuccess.waiting
            ? AsyncResult.waiting(projected)
            : projected;
        }
      );
    });
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
  readonly scope: WalletScopeKey | null;
}> {}

export const activityFilterOptionsAtom = Atom.family(
  (key: ActivityFilterOptionsKey) =>
    appRuntime.atom((context) =>
      Effect.gen(function* () {
        if (!key.scope) return [];
        const scope = key.scope;
        const count = (filter: ActivityFilter) => {
          const historyKey = getActivityHistoryKey(
            new ActivityActionsKey({ filter, scope })
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
        const visible = categoryCounts.filter((item) => item.count > 0);

        return visible.length > 0
          ? [{ filter: "all" as const, count: allCount }, ...visible]
          : [];
      }).pipe(Effect.mapError(toActivityActionsError))
    )
);
