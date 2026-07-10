import {
  useAtom,
  useAtomMount,
  useAtomRefresh,
  useAtomValue,
} from "@effect/atom-react";
import { Data, Duration, Effect, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  valueEqualAtomFamily,
  withApiResourcePolicy,
} from "../../atoms/api-resource";
import { getPullResultItems, paginatedApiStream } from "../../atoms/pagination";
import { ActivityActionsPage } from "../../domain/schema/activity-models";
import { WalletAddress } from "../../domain/schema/identifiers";
import { Network } from "../../domain/schema/wallet-models";
import { getActionValidatorAddresses } from "../../domain/types/action";
import {
  type ActivityFilter,
  activityFilterCategories,
} from "../../pages/details/activity-page/activity-filters";
import type { ActivityFilterOption } from "../../pages/details/activity-page/hooks/use-activity-filters";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";
import { useSKWallet } from "../../providers/sk-wallet";
import {
  ActivityActionsKey,
  getActivityActionsRequestParams,
} from "./activity-requests";
import { getYieldValidatorsByAddressesEffect } from "./use-yield-validators";
import { YieldOpportunityKey, yieldOpportunityAtom } from "./yield-atoms";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;

class ActivityActionsError extends Data.TaggedError("ActivityActionsError")<{
  readonly cause: unknown;
}> {}

const activityTotalAtom = valueEqualAtomFamily((_key: ActivityActionsKey) =>
  Atom.make<number | null>(null)
);
const activityHasNextPageAtom = valueEqualAtomFamily(
  (_key: ActivityActionsKey) => Atom.make(false)
);

const makeActivityActionsPullAtom = (key: ActivityActionsKey) =>
  stakeKitApiRuntime.pull(
    (context) => {
      if (!key.enabled || !key.address || !key.network) return Stream.empty;
      const address = key.address;
      const network = key.network;

      return paginatedApiStream({
        fetchPage: (offset) =>
          Effect.gen(function* () {
            const api = yield* StakeKitApiService;
            const response = yield* api.yield.ActionsControllerGetActions({
              params: getActivityActionsRequestParams({
                address,
                filter: key.filter,
                limit: PAGE_SIZE,
                network,
                offset,
              }),
            });
            const page =
              yield* Schema.decodeUnknownEffect(ActivityActionsPage)(response);
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
                        new YieldOpportunityKey({
                          decodeIssue: null,
                          yieldId: action.yieldId,
                        })
                      )
                    )
                    .pipe(Effect.option);
                  const yieldData = Option.getOrNull(yieldResult);
                  const validatorsData =
                    yield* getYieldValidatorsByAddressesEffect({
                      addresses: getActionValidatorAddresses(action) ?? [],
                      yieldId: action.yieldId,
                    }).pipe(Effect.orElseSucceed(() => []));

                  return { actionData: action, validatorsData, yieldData };
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
  );

const activityActionsPullAtom = valueEqualAtomFamily(
  makeActivityActionsPullAtom
);

class ActivityFilterOptionsKey extends Data.Class<{
  readonly address: typeof WalletAddress.Type | null;
  readonly network: Network | null;
}> {}

const activityFilterOptionsAtom = valueEqualAtomFamily(
  (key: ActivityFilterOptionsKey) =>
    stakeKitApiRuntime
      .atom(() =>
        Effect.gen(function* () {
          if (!key.address || !key.network) return [];

          const api = yield* StakeKitApiService;
          const count = (filter: ActivityFilter) =>
            api.yield
              .ActionsControllerGetActions({
                params: getActivityActionsRequestParams({
                  address: key.address!,
                  filter,
                  limit: COUNT_PAGE_SIZE,
                  network: key.network!,
                  offset: 0,
                }),
              })
              .pipe(
                Effect.flatMap((response) =>
                  Schema.decodeUnknownEffect(ActivityActionsPage)(response)
                ),
                Effect.map((page) => page.total)
              );
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
        withApiResourcePolicy({
          idleTTL: Duration.minutes(5),
          staleTime: Duration.minutes(1),
          revalidateOnMount: true,
        })
      )
);

const useActivityKeyValues = () => {
  const { address: rawAddress, network: rawNetwork } = useSKWallet();
  const address = rawAddress
    ? Schema.decodeUnknownSync(WalletAddress)(rawAddress)
    : null;
  const network = rawNetwork
    ? Schema.decodeUnknownSync(Network)(rawNetwork)
    : null;

  return { address, network };
};

export const useActivityFilterOptions = (): ActivityFilterOption[] => {
  const { address, network } = useActivityKeyValues();
  const result = useAtomValue(
    activityFilterOptionsAtom(
      new ActivityFilterOptionsKey({ address, network })
    )
  );

  return result.pipe(
    AsyncResult.value,
    Option.getOrElse(() => [])
  );
};

export const usePrefetchActivityActionFilters = ({
  filterOptions,
}: {
  filterOptions: ActivityFilterOption[];
}) => {
  const { address, network } = useActivityKeyValues();
  const enabled = !!address && !!network && filterOptions.length > 0;
  const make = (filter: ActivityFilter) =>
    activityActionsPullAtom(
      new ActivityActionsKey({ address, enabled, filter, network })
    );

  useAtomMount(make("all"));
  useAtomMount(make("stake"));
  useAtomMount(make("defi"));
  useAtomMount(make("rwa"));
};

export const useActivityActions = (filter: ActivityFilter = "all") => {
  const { address, network } = useActivityKeyValues();
  const key = new ActivityActionsKey({
    address,
    enabled: !!address && !!network,
    filter,
    network,
  });
  const resource = activityActionsPullAtom(key);
  const [result, pull] = useAtom(resource);
  const refresh = useAtomRefresh(resource);
  const total = useAtomValue(activityTotalAtom(key));
  const hasNextPage = useAtomValue(activityHasNextPageAtom(key));
  const allItems = [...getPullResultItems(result)];

  return {
    allItems,
    data: total === null ? undefined : { pages: [{ total }] },
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    fetchNextPage: pull,
    hasNextPage,
    isFetchingNextPage: result.waiting && allItems.length > 0,
    isLoading: result.waiting && allItems.length === 0,
    isPending: result.waiting && allItems.length === 0,
    refetch: refresh,
  } as const;
};
