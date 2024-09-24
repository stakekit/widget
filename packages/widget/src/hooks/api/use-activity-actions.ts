import { getYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import {
  type ActionListParams,
  getActionListQueryKey,
  useActionListHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useMemo } from "react";

export const useActivityActions = (props: ActionListParams) => {
  const { address } = useSKWallet();
  const getActionList = useActionListHook();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();
  const { isLedgerLive } = useSKWallet();
  const queryClient = useSKQueryClient();

  const query = useInfiniteQuery({
    enabled: !!address,
    queryKey: getActionListQueryKey(props),
    queryFn: async ({ pageParam = 1 }) => {
      return (
        await EitherAsync(() =>
          getActionList({
            ...props,
            page: pageParam,
            walletAddress: address!,
          })
        )
          .mapLeft(() => new Error("Could not get action list"))
          .chain(async (actionList) =>
            EitherAsync.all(
              actionList.data.map((action) =>
                getYieldOpportunity({
                  yieldId: action.integrationId,
                  isLedgerLive,
                  queryClient,
                  yieldYieldOpportunity,
                })
                  .map((yieldData) => ({ actionData: action, yieldData }))
                  .chainLeft(() => EitherAsync(() => Promise.resolve(null)))
              )
            )
              .map((res) => res.filter((x) => x !== null))
              .map((data) => ({ ...actionList, data }))
          )
      ).unsafeCoerce();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.hasNextPage ? lastPage.page + 1 : undefined;
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
