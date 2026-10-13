import { type Cause, Data, Array as EArray, Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { YieldAction } from "../../../domain/action/models";
import {
  ActionStatus,
  getActionValidatorAddresses,
} from "../../../domain/action/rules";
import { getActivityActionCapabilities } from "../../../domain/activity/action-capabilities";
import type { Market } from "../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../domain/borrow/catalog/token";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { BorrowActivityAction } from "../../../domain/borrow/responses";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type {
  ValidatorAddress,
  YieldId,
} from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  type ActivityHistoryBatch,
  type ActivityHistoryEntry,
  type ActivityHistoryError,
  ActivityHistoryKey,
  activityCountResourceAtom,
  activityHistoryPullAtom,
} from "../../../resources/activity-history/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../resources/borrow-markets/index";
import {
  ValidatorByAddressKey,
  validatorByAddressAtom,
} from "../../../resources/validator-directory/index";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/index";
import { mapAsyncResultError } from "../../../shared/effect/async-result";
import { withPullPageDone } from "../../../shared/effect/pagination";
import type { ActivityActionItem } from "../model/activity-action";
import {
  type ActivityFilter,
  activityFilterCategories,
  getActivityFilterYieldTypes,
} from "../model/filters";

const ACTIVITY_ACTION_STATUSES = Object.values(ActionStatus).filter(
  (status) => getActivityActionCapabilities(status).visibleInFeed
);

export class ActivityActionsKey extends Data.Class<{
  readonly filter: ActivityFilter;
  readonly scope: WalletScopeKey | null;
}> {}

export const getActivityHistoryKey = (
  key: ActivityActionsKey
): ActivityHistoryKey | null => {
  if (!key.scope) return null;

  return new ActivityHistoryKey({
    scope: key.scope,
    statuses: ACTIVITY_ACTION_STATUSES,
    yieldTypes: getActivityFilterYieldTypes(key.filter),
  });
};

export const activityFilterAtom = Atom.make<ActivityFilter>("all").pipe(
  Atom.withLabel("activityFilterAtom")
);

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
  readonly borrowNetworks: ReadonlyArray<BorrowNetwork>;
  readonly validatorKeys: ReadonlyArray<ValidatorByAddressKey>;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(entries: ReadonlyArray<ActivityHistoryEntry>) {
    const validatorKeys = new Map<string, ValidatorByAddressKey>();
    const yieldActions: Array<YieldAction> = [];
    const borrowNetworks = new Set<BorrowNetwork>();

    for (const entry of entries) {
      if (entry._tag === "borrow") {
        for (const transaction of entry.action.transactions) {
          borrowNetworks.add(transaction.network);
        }
        continue;
      }

      const action = entry.action;
      yieldActions.push(action);
      for (const address of getActionValidatorAddresses(action) ?? []) {
        const key = new ValidatorByAddressKey({
          address,
          yieldId: action.yieldId,
        });
        validatorKeys.set(validatorFactKey(key), key);
      }
    }

    super({
      borrowNetworks: [...borrowNetworks].sort(),
      validatorKeys: [...validatorKeys.values()].sort((first, second) =>
        validatorFactKey(first).localeCompare(validatorFactKey(second))
      ),
      yieldIds: [
        ...new Set(yieldActions.map((action) => action.yieldId)),
      ].sort(),
    });
  }
}

const BORROW_DEBT_ACTIONS: Record<BorrowActivityAction["action"], boolean> = {
  borrow: true,
  disableCollateral: false,
  enableCollateral: false,
  repay: true,
  supply: false,
  supplyAndBorrow: true,
  withdraw: false,
};

/** Borrow actions name a token by address; the market catalog names it. */
const resolveBorrowActivityToken = (
  action: BorrowActivityAction,
  market: Market | undefined
): BorrowToken | null => {
  if (!market) return null;

  const tokenAddress = action.rawArguments?.tokenAddress?.toLowerCase();
  if (tokenAddress) {
    const tokens = [
      market.loanToken,
      ...market.collateralTokens.map((collateral) => collateral.token),
    ];

    return (
      tokens.find((token) => token.address?.toLowerCase() === tokenAddress) ??
      null
    );
  }
  if (BORROW_DEBT_ACTIONS[action.action]) return market.loanToken;
  // Pool markets list every collateral, so only an isolated market implies one.
  if (market.type === "isolated") {
    return market.collateralTokens[0]?.token ?? null;
  }
  return null;
};

type ActivityEnrichmentFacts = {
  readonly borrowMarketsById: ReadonlyMap<string, Market>;
  readonly validatorsByKey: ReadonlyMap<string, EarnValidator>;
  readonly yieldsById: ReadonlyMap<YieldId, EarnYieldWithProvider | null>;
};

type ActivityEnrichmentFact =
  | {
      readonly _tag: "borrowMarkets";
      readonly value: ReadonlyArray<Market>;
    }
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

type ActivityEnrichmentRequest =
  | { readonly _tag: "borrowMarkets"; readonly network: BorrowNetwork }
  | { readonly _tag: "validator"; readonly validatorKey: ValidatorByAddressKey }
  | { readonly _tag: "yield"; readonly yieldId: YieldId };

const activityEnrichmentFactsAtom = Atom.family((key: ActivityEnrichmentKey) =>
  appRuntime
    .atom((context) => {
      const requests: Array<ActivityEnrichmentRequest> = [
        ...key.yieldIds.map((yieldId) => ({ _tag: "yield" as const, yieldId })),
        ...key.validatorKeys.map((validatorKey) => ({
          _tag: "validator" as const,
          validatorKey,
        })),
        ...key.borrowNetworks.map((network) => ({
          _tag: "borrowMarkets" as const,
          network,
        })),
      ];
      const loadFact = (
        request: ActivityEnrichmentRequest
      ): Effect.Effect<ActivityEnrichmentFact> => {
        switch (request._tag) {
          case "yield":
            return context
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
              );
          case "validator":
            return context
              .resultOnce(validatorByAddressAtom.local(request.validatorKey))
              .pipe(
                Effect.catchCause(() => Effect.succeed(null)),
                Effect.map((value) => ({
                  _tag: "validator" as const,
                  key: request.validatorKey,
                  value,
                }))
              );
          case "borrowMarkets":
            return context
              .resultOnce(
                borrowMarketsResourceAtom.local(
                  new BorrowMarketsKey({
                    network: request.network,
                    scope: "all",
                  })
                )
              )
              .pipe(
                Effect.catchCause(() => Effect.succeed([])),
                Effect.map((value) => ({
                  _tag: "borrowMarkets" as const,
                  value,
                }))
              );
        }
      };

      return Effect.forEach(requests, loadFact, {
        concurrency: ACTIVITY_ENRICHMENT_CONCURRENCY,
      }).pipe(
        Effect.map((facts): ActivityEnrichmentFacts => {
          const borrowMarketsById = new Map<string, Market>();
          const validatorsByKey = new Map<string, EarnValidator>();
          const yieldsById = new Map<YieldId, EarnYieldWithProvider | null>();

          for (const fact of facts) {
            if (fact._tag === "yield") {
              yieldsById.set(fact.yieldId, fact.value);
            } else if (fact._tag === "borrowMarkets") {
              for (const market of fact.value) {
                borrowMarketsById.set(market.id, market);
              }
            } else if (fact.value) {
              validatorsByKey.set(validatorFactKey(fact.key), fact.value);
            }
          }

          return { borrowMarketsById, validatorsByKey, yieldsById };
        })
      );
    })
    .pipe(Atom.withLabel("activityEnrichmentFactsAtom"))
);

const projectYieldActivityItem = (
  action: YieldAction,
  walletScope: WalletScopeKey,
  { validatorsByKey, yieldsById }: ActivityEnrichmentFacts
): ActivityActionItem => ({
  _tag: "yield",
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
});

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
            AsyncResult.map((facts) => ({
              done,
              items: EArray.map(batches, (batch) => ({
                ...batch,
                actions: EArray.map(
                  batch.actions,
                  (entry): ActivityActionItem =>
                    entry._tag === "yield"
                      ? projectYieldActivityItem(
                          entry.action,
                          walletScope,
                          facts
                        )
                      : {
                          _tag: "borrow",
                          actionData: entry.action,
                          token: resolveBorrowActivityToken(
                            entry.action,
                            facts.borrowMarketsById.get(
                              entry.action.rawArguments?.marketId ?? ""
                            )
                          ),
                          walletScope,
                        }
                ),
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
