import { useInfiniteQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useMemo } from "react";
import {
  type ActionDto,
  ActionStatus,
  getActionInputToken,
} from "../../domain/types/action";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useYieldApiFetchClient } from "../../providers/yield-api-client-provider";
import { listActions } from "../../providers/yield-api-client-provider/actions";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";

const PAGE_SIZE = 20;

export const useActivityActions = () => {
  const { address, isLedgerLive, network } = useSKWallet();
  const queryClient = useSKQueryClient();
  const yieldApiFetchClient = useYieldApiFetchClient();

  const query = useInfiniteQuery({
    enabled: !!address,
    queryKey: ["activity-actions", address, network],
    queryFn: async ({ pageParam = 0 }) => {
      return (
        await EitherAsync(() =>
          listActions({
            address: address!,
            fetchClient: yieldApiFetchClient,
            limit: PAGE_SIZE,
            offset: pageParam,
          }),
        )
          .mapLeft(() => new Error("Could not get action list"))
          .map((actionList) => ({
            ...actionList,
            data: (actionList.items ?? []).filter(
              (action) =>
                action.status !== ActionStatus.CREATED &&
                (!network ||
                  action.transactions.some((tx) => tx.network === network)),
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
                    actionData: action as ActionDto,
                    yieldData,
                  }))
                  .chainLeft(() => EitherAsync(() => Promise.resolve(null))),
              ),
            )
              .map((res) => res.filter((x) => x !== null))
              .map((res) =>
                res.filter(
                  (x) =>
                    !!getActionInputToken({
                      actionDto: x.actionData,
                      yieldDto: x.yieldData,
                    }),
                ),
              )
              .map((data) => ({ ...actionList, data })),
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
    [query.data],
  );

  return {
    allItems,
    ...query,
  };
};
