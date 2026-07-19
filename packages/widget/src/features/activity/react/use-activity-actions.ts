import { useAtom, useAtomMount, useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { getActionValidatorAddresses } from "../../../domain/types/action";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { resourceInvalidationKeys } from "../../../services/resource-invalidation";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  getPullResultItems,
  paginatedApiStream,
} from "../../../shared/effect/pagination";
import { getYieldValidatorsByAddressesEffect } from "../../earn/react/use-yield-validators";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../earn/resources/yields";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";
import {
  type ActivityFilter,
  type ActivityFilterOption,
  activityFilterCategories,
} from "../model/filters";
import {
  ActivityActionsKey,
  getActivityActionsRequestParams,
} from "../resources/activity-requests";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;

class ActivityActionsError extends Data.TaggedError("ActivityActionsError")<{
  readonly cause: unknown;
}> {}

const activityTotalAtom = Atom.family((_key: ActivityActionsKey) =>
  Atom.make<number | null>(null)
);
const activityHasNextPageAtom = Atom.family((_key: ActivityActionsKey) =>
  Atom.make(false)
);

const makeActivityActionsPullAtom = (key: ActivityActionsKey) =>
  appRuntime
    .pull(
      (context) => {
        if (!key.scope) return Stream.empty;
        const walletScope = key.scope;
        const { address, network } = walletScope;

        return paginatedApiStream({
          fetchPage: (offset) =>
            Effect.gen(function* () {
              const api = yield* YieldApiService;
              const page = yield* api.getActivityActions(
                getActivityActionsRequestParams({
                  address,
                  filter: key.filter,
                  limit: PAGE_SIZE,
                  network,
                  offset,
                })
              );
              context.set(activityTotalAtom(key), page.total);
              context.set(
                activityHasNextPageAtom(key),
                page.offset + page.limit < page.total
              );
              const data = yield* Effect.forEach(
                page.items ?? [],
                (action) =>
                  Effect.gen(function* () {
                    const yieldResult = yield* context
                      .result(
                        yieldOpportunityAtom(
                          new YieldOpportunityKey({ yieldId: action.yieldId })
                        )
                      )
                      .pipe(Effect.option);
                    const yieldData = Option.getOrNull(yieldResult);
                    const validatorsData =
                      yield* getYieldValidatorsByAddressesEffect({
                        addresses: getActionValidatorAddresses(action) ?? [],
                        yieldId: action.yieldId,
                      }).pipe(Effect.orElseSucceed(() => []));

                    return {
                      actionData: action,
                      validatorsData,
                      walletScope,
                      yieldData,
                    };
                  }),
                { concurrency: 5 }
              );

              return {
                items: data,
                limit: page.limit,
                offset: page.offset,
                total: page.total,
              };
            }).pipe(
              Effect.mapError((cause) => new ActivityActionsError({ cause }))
            ),
        });
      },
      { initialValue: [] }
    )
    .pipe(Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)));

export const activityActionsPullAtom = Atom.family(makeActivityActionsPullAtom);

const currentActivityActionsKeyAtom = Atom.family((filter: ActivityFilter) =>
  Atom.make((get) => {
    const scope = get(currentWalletScopeAtom);

    return new ActivityActionsKey({
      filter,
      scope,
    });
  })
);

const currentActivityActionsPullAtom = Atom.family((filter: ActivityFilter) =>
  Atom.writable<Atom.Type<ReturnType<typeof activityActionsPullAtom>>, void>(
    (context) =>
      context.get(
        activityActionsPullAtom(
          context.get(currentActivityActionsKeyAtom(filter))
        )
      ),
    (context, _value) =>
      context.set(
        activityActionsPullAtom(
          context.get(currentActivityActionsKeyAtom(filter))
        ),
        undefined
      )
  )
);

const currentPrefetchActivityActionsKeyAtom = Atom.family(
  (filter: ActivityFilter) =>
    Atom.make((get) => {
      const scope = get(currentWalletScopeAtom);
      const filterOptions = get(currentActivityFilterOptionsAtom).pipe(
        AsyncResult.value,
        Option.getOrElse(() => [])
      );
      const enabled = filterOptions.length > 0;

      return new ActivityActionsKey({
        filter,
        scope: enabled ? scope : null,
      });
    })
);

const currentPrefetchActivityActionsPullAtom = Atom.family(
  (filter: ActivityFilter) =>
    Atom.writable<Atom.Type<ReturnType<typeof activityActionsPullAtom>>, void>(
      (context) =>
        context.get(
          activityActionsPullAtom(
            context.get(currentPrefetchActivityActionsKeyAtom(filter))
          )
        ),
      (context, _value) =>
        context.set(
          activityActionsPullAtom(
            context.get(currentPrefetchActivityActionsKeyAtom(filter))
          ),
          undefined
        )
    )
);

const currentActivityTotalAtom = Atom.family((filter: ActivityFilter) =>
  Atom.make((get) =>
    get(activityTotalAtom(get(currentActivityActionsKeyAtom(filter))))
  )
);

const currentActivityHasNextPageAtom = Atom.family((filter: ActivityFilter) =>
  Atom.make((get) =>
    get(activityHasNextPageAtom(get(currentActivityActionsKeyAtom(filter))))
  )
);

const currentActivityActionsRefreshAtom = Atom.family(
  (filter: ActivityFilter) =>
    Atom.make(
      (get) => () =>
        get.refresh(
          activityActionsPullAtom(get(currentActivityActionsKeyAtom(filter)))
        )
    )
);

export class ActivityFilterOptionsKey extends Data.Class<{
  readonly scope: WalletScopeKey | null;
}> {}

export const activityFilterOptionsAtom = Atom.family(
  (key: ActivityFilterOptionsKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (!key.scope) return [];
          const scope = key.scope;

          const api = yield* YieldApiService;
          const count = (filter: ActivityFilter) =>
            api
              .getActivityActions(
                getActivityActionsRequestParams({
                  address: scope.address,
                  filter,
                  limit: COUNT_PAGE_SIZE,
                  network: scope.network,
                  offset: 0,
                })
              )
              .pipe(Effect.map((page) => page.total));
          const allCount = yield* count("all");

          if (allCount <= 0) return [];

          const categoryCounts = yield* Effect.forEach(
            activityFilterCategories,
            (filter) =>
              count(filter).pipe(Effect.map((count) => ({ filter, count }))),
            { concurrency: 3 }
          );
          const visible = categoryCounts.filter((item) => item.count > 0);

          return visible.length > 0
            ? [{ filter: "all" as const, count: allCount }, ...visible]
            : [];
        }).pipe(Effect.mapError((cause) => new ActivityActionsError({ cause })))
      )
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.activity(key.scope)),
        withApiResourcePolicy({
          idleTTL: Duration.minutes(5),
          staleTime: Duration.minutes(1),
          revalidateOnMount: true,
        })
      )
);

const currentActivityFilterOptionsAtom = Atom.make((get) => {
  const scope = get(currentWalletScopeAtom);

  return get(
    activityFilterOptionsAtom(
      new ActivityFilterOptionsKey({
        scope,
      })
    )
  );
}).pipe(Atom.withLabel("currentActivityFilterOptionsAtom"));

export const useActivityFilterOptions = (): ActivityFilterOption[] => {
  const result = useAtomValue(currentActivityFilterOptionsAtom);

  return result.pipe(
    AsyncResult.value,
    Option.getOrElse(() => [])
  );
};

export const usePrefetchActivityActionFilters = () => {
  const make = (filter: ActivityFilter) =>
    currentPrefetchActivityActionsPullAtom(filter);

  useAtomMount(make("all"));
  useAtomMount(make("stake"));
  useAtomMount(make("defi"));
  useAtomMount(make("rwa"));
};

export const useActivityActions = (filter: ActivityFilter = "all") => {
  const resource = currentActivityActionsPullAtom(filter);
  const [result, pull] = useAtom(resource);
  const refresh = useAtomValue(currentActivityActionsRefreshAtom(filter));
  const total = useAtomValue(currentActivityTotalAtom(filter));
  const hasNextPage = useAtomValue(currentActivityHasNextPageAtom(filter));
  const allItems = [...getPullResultItems(result)];

  return {
    allItems,
    data: total === null ? undefined : { pages: [{ total }] },
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    fetchNextPage: () => pull(),
    hasNextPage,
    isFetchingNextPage: result.waiting && allItems.length > 0,
    isLoading: result.waiting && allItems.length === 0,
    isPending: result.waiting && allItems.length === 0,
    refetch: refresh,
  } as const;
};
