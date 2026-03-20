import { type ActionDto, ActionStatus } from "@stakekit/api-hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useMemo } from "react";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useYieldApiFetchClient } from "../../providers/yield-api-client-provider";
import { listActions } from "../../providers/yield-api-client-provider/actions";
import { adaptActionDto } from "../../providers/yield-api-client-provider/compat";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";

const PAGE_SIZE = 20;

export const useActivityActions = () => {
  const { address, isLedgerLive } = useSKWallet();
  const queryClient = useSKQueryClient();
  const yieldApiFetchClient = useYieldApiFetchClient();

  const query = useInfiniteQuery({
    enabled: !!address,
    queryKey: ["activity-actions", address],
    queryFn: async ({ pageParam = 0 }) => {
      return (
        await EitherAsync(() =>
          listActions({
            address: address!,
            fetchClient: yieldApiFetchClient,
            limit: PAGE_SIZE,
            offset: pageParam,
          })
        )
          .mapLeft(() => new Error("Could not get action list"))
          .map((actionList) => ({
            ...actionList,
            data: (actionList.items ?? []).filter(
              (x) => x.status !== ActionStatus.CREATED
            ),
          }))
          .chain(async (actionList) =>
            EitherAsync.all(
              actionList.data.map((action) =>
                getYieldOpportunity({
                  yieldId: action.yieldId,
                  queryClient,
                  isLedgerLive,
                  yieldApiFetchClient,
                })
                  .map((yieldData) => ({
                    actionData: adaptActionDto({
                      actionDto: action,
                      addresses: { address: action.address },
                      gasFeeToken: yieldData.metadata.gasFeeToken,
                      yieldDto: yieldData,
                    }) as ActionDto,
                    yieldData,
                  }))
                  .chainLeft(() => EitherAsync(() => Promise.resolve(null)))
              )
            )
              .map((res) => res.filter((x) => x !== null))
              .map((res) => res.filter((x) => !!x.actionData.inputToken))
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
