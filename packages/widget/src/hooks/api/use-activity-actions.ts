import { type QueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useMemo } from "react";
import {
  type ActionDto,
  getActionInputToken,
  getActionValidatorAddresses,
} from "../../domain/types/action";
import type { ValidatorDto } from "../../domain/types/validators";
import type { Yield } from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";
import { getYieldValidatorsByAddresses } from "./use-yield-validators";

const PAGE_SIZE = 50;
const ACTIVITY_VALIDATOR_ENRICHMENT_CONCURRENCY = 5;

type ActivityActionItem = {
  actionData: ActionDto;
  yieldData: Yield;
  validatorsData: ValidatorDto[];
};

type ActivityActionBaseItem = Omit<ActivityActionItem, "validatorsData">;

type UseActivityActionsResult = ReturnType<typeof useInfiniteQuery> & {
  allItems: ActivityActionItem[] | undefined;
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
          }),
        }))
      ))
    );
  }

  return data;
};

export const useActivityActions = (): UseActivityActionsResult => {
  const { address, isLedgerLive, network } = useSKWallet();
  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  const query = useInfiniteQuery({
    enabled: !!address && !!network,
    queryKey: ["activity-actions", address, network],
    queryFn: async ({ pageParam = 0 }) => {
      return (
        await EitherAsync(() =>
          apiClient.yield.ActionsControllerGetActions({
            params: {
              address: address!,
              limit: PAGE_SIZE,
              offset: pageParam,
              network: network!,
              // Pending actions are filtered out; only completed (SUCCESS) and
              // retryable error (FAILED) actions are surfaced in the activity list.
              statuses: ["SUCCESS", "FAILED"],
            },
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
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = (lastPage.offset ?? 0) + (lastPage.limit ?? PAGE_SIZE);
      return nextOffset < (lastPage.total ?? 0) ? nextOffset : undefined;
    },
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
