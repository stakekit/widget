import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useEffect, useMemo } from "react";
import {
  type ActionDto,
  getActionInputToken,
  getActionValidatorAddresses,
} from "../../domain/types/action";
import type { Yield } from "../../domain/types/yields";
import type {
  ActionsControllerGetActionsParams,
  ValidatorDto,
} from "../../generated/api/yield";
import {
  type ActivityFilter,
  activityFilterCategories,
  getActivityFilterYieldTypes,
} from "../../pages/details/activity-page/activity-filters";
import type { ActivityFilterOption } from "../../pages/details/activity-page/hooks/use-activity-filters";
import type { ApiClient } from "../../providers/api/api-client";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";
import { getYieldValidatorsByAddresses } from "./use-yield-validators";

const PAGE_SIZE = 50;
const COUNT_PAGE_SIZE = 1;
const ACTIVITY_VALIDATOR_ENRICHMENT_CONCURRENCY = 5;
const ACTIVITY_ACTION_STATUSES = [
  "SUCCESS",
  "FAILED",
] as const satisfies NonNullable<ActionsControllerGetActionsParams["statuses"]>;

type ActivityActionItem = {
  actionData: ActionDto;
  yieldData: Yield;
  validatorsData: ValidatorDto[];
};

type ActivityActionBaseItem = Omit<ActivityActionItem, "validatorsData">;
type ActivityActionsPage = Awaited<
  ReturnType<ApiClient["yield"]["ActionsControllerGetActions"]>
> & {
  data: ActivityActionItem[];
};

type UseActivityActionsResult = ReturnType<typeof useInfiniteQuery> & {
  allItems: ActivityActionItem[] | undefined;
};

type ActivityActionsRequestParams = {
  address: string;
  filter: ActivityFilter;
  limit: number;
  network: NonNullable<ActionsControllerGetActionsParams["network"]>;
  offset: number;
};

type ActivityFilterOptionsParams = {
  address: string;
  apiClient: ApiClient;
  network: NonNullable<ActionsControllerGetActionsParams["network"]>;
  signal?: AbortSignal;
};

type FetchActivityActionsPageParams = {
  address: string;
  apiClient: ApiClient;
  filter: ActivityFilter;
  isLedgerLive: boolean;
  network: NonNullable<ActionsControllerGetActionsParams["network"]>;
  offset: number;
  queryClient: QueryClient;
  signal?: AbortSignal;
  suppressRichErrors?: boolean;
};

export const getActivityActionsQueryKey = ({
  address,
  filter,
  network,
}: {
  address: string | null | undefined;
  filter: ActivityFilter;
  network: ActionsControllerGetActionsParams["network"] | null | undefined;
}) =>
  [
    "activity-actions",
    {
      address,
      filter,
      network,
      yieldTypes: getActivityFilterYieldTypes(filter),
    },
  ] as const;

const getActivityFilterOptionsQueryKey = ({
  address,
  network,
}: {
  address: string | null | undefined;
  network: ActionsControllerGetActionsParams["network"] | null | undefined;
}) => ["activity-action-filter-options", { address, network }] as const;

export const getActivityActionsRequestParams = ({
  address,
  filter,
  limit,
  network,
  offset,
}: ActivityActionsRequestParams): ActionsControllerGetActionsParams => {
  const yieldTypes = getActivityFilterYieldTypes(filter);

  return {
    address,
    limit,
    offset,
    network,
    // Pending actions are filtered out; only completed (SUCCESS) and retryable
    // error (FAILED) actions are surfaced in the activity list.
    statuses: ACTIVITY_ACTION_STATUSES,
    ...(yieldTypes?.length ? { yieldTypes } : {}),
  };
};

export const fetchActivityFilterOptions = async ({
  address,
  apiClient,
  network,
  signal,
}: ActivityFilterOptionsParams): Promise<ActivityFilterOption[]> => {
  const client = apiClient.withOptions({ signal, suppressRichErrors: true });
  const getCount = async (filter: ActivityFilter) => {
    const result = await client.yield.ActionsControllerGetActions({
      params: getActivityActionsRequestParams({
        address,
        filter,
        limit: COUNT_PAGE_SIZE,
        network,
        offset: 0,
      }),
    });

    return result.total;
  };

  const allCount = await getCount("all");

  if (allCount <= 0) return [];

  const categoryOptions = await Promise.all(
    activityFilterCategories.map(async (filter) => ({
      filter,
      count: await getCount(filter),
    }))
  );
  const visibleCategoryOptions = categoryOptions.filter(
    (option) => option.count > 0
  );

  return visibleCategoryOptions.length > 0
    ? [{ filter: "all", count: allCount }, ...visibleCategoryOptions]
    : [];
};

const getItemsWithValidators = async ({
  items,
  apiClient,
  queryClient,
}: {
  items: ActivityActionBaseItem[];
  apiClient: ReturnType<typeof useApiClient>;
  queryClient: QueryClient;
}) => {
  const data: ActivityActionItem[] = [];

  for (
    let index = 0;
    index < items.length;
    index += ACTIVITY_VALIDATOR_ENRICHMENT_CONCURRENCY
  ) {
    const chunk = items.slice(
      index,
      index + ACTIVITY_VALIDATOR_ENRICHMENT_CONCURRENCY
    );

    data.push(
      ...(await Promise.all(
        chunk.map(async (item) => ({
          ...item,
          validatorsData: await getYieldValidatorsByAddresses({
            apiClient,
            queryClient,
            yieldId: item.actionData.yieldId,
            addresses: getActionValidatorAddresses(item.actionData) ?? [],
            suppressRichErrors: true,
          }),
        }))
      ))
    );
  }

  return data;
};

const getNextActivityActionsPageParam = (lastPage: ActivityActionsPage) => {
  const nextOffset = (lastPage.offset ?? 0) + (lastPage.limit ?? PAGE_SIZE);

  return nextOffset < (lastPage.total ?? 0) ? nextOffset : undefined;
};

const fetchActivityActionsPage = async ({
  address,
  apiClient,
  filter,
  isLedgerLive,
  network,
  offset,
  queryClient,
  signal,
  suppressRichErrors,
}: FetchActivityActionsPageParams): Promise<ActivityActionsPage> => {
  return (
    await EitherAsync(() =>
      apiClient
        .withOptions({ signal, suppressRichErrors })
        .yield.ActionsControllerGetActions({
          params: getActivityActionsRequestParams({
            address,
            filter,
            limit: PAGE_SIZE,
            offset,
            network,
          }),
        })
    )
      .mapLeft(() => new Error("Could not get action list"))
      .chain(async (actionList) =>
        EitherAsync.all(
          (actionList.items ?? []).map((action) =>
            getYieldOpportunity({
              yieldId: action.yieldId,
              queryClient,
              isLedgerLive,
              apiClient,
              suppressRichErrors: true,
            })
              .map((yieldData) => ({
                actionData: action as ActionDto,
                yieldData,
              }))
              .chainLeft(() => EitherAsync(() => Promise.resolve(null)))
          )
        )
          .map((res) => res.filter((x) => x !== null))
          .map((res) =>
            res.filter(
              (x) =>
                !!getActionInputToken({
                  actionDto: x.actionData,
                  yieldDto: x.yieldData,
                })
            )
          )
          .chain((items) =>
            EitherAsync(() =>
              getItemsWithValidators({
                items,
                apiClient,
                queryClient,
              })
            )
          )
          .map((data) => ({ ...actionList, data }))
      )
  ).unsafeCoerce();
};

export const useActivityFilterOptions = (): ActivityFilterOption[] => {
  const { address, network } = useSKWallet();
  const apiClient = useApiClient();

  const query = useQuery({
    enabled: !!address && !!network,
    queryKey: getActivityFilterOptionsQueryKey({ address, network }),
    queryFn: async ({ signal }) =>
      fetchActivityFilterOptions({
        address: address!,
        apiClient,
        network: network!,
        signal,
      }).catch(() => []),
    staleTime: 1000 * 60,
  });

  return query.data ?? [];
};

export const usePrefetchActivityActionFilters = ({
  filterOptions,
}: {
  filterOptions: ActivityFilterOption[];
}) => {
  const { address, isLedgerLive, network } = useSKWallet();
  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  useEffect(() => {
    if (!address || !network || filterOptions.length === 0) return;

    for (const { filter } of filterOptions) {
      queryClient
        .prefetchInfiniteQuery({
          queryKey: getActivityActionsQueryKey({ address, network, filter }),
          queryFn: ({ pageParam = 0, signal }) =>
            fetchActivityActionsPage({
              address,
              apiClient,
              filter,
              isLedgerLive,
              network,
              offset: pageParam as number,
              queryClient,
              signal,
              suppressRichErrors: true,
            }),
          initialPageParam: 0,
          getNextPageParam: getNextActivityActionsPageParam,
        })
        .catch(() => undefined);
    }
  }, [address, apiClient, filterOptions, isLedgerLive, network, queryClient]);
};

export const useActivityActions = (
  filter: ActivityFilter = "all"
): UseActivityActionsResult => {
  const { address, isLedgerLive, network } = useSKWallet();
  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  const query = useInfiniteQuery({
    enabled: !!address && !!network,
    queryKey: getActivityActionsQueryKey({ address, network, filter }),
    queryFn: async ({ pageParam = 0, signal }) =>
      fetchActivityActionsPage({
        address: address!,
        apiClient,
        filter,
        isLedgerLive,
        network: network!,
        offset: pageParam as number,
        queryClient,
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: getNextActivityActionsPageParam,
  });

  const allItems = useMemo(
    () => query.data?.pages.flatMap((page) => page.data),
    [query.data]
  );

  return {
    allItems,
    ...query,
  };
};
