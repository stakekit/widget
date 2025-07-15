import {
  type ActionDto,
  type ActionList200,
  ActionStatus,
  actionList,
  getActionListQueryKey,
} from "@stakekit/api-hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useMemo } from "react";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useWhitelistedValidators } from "../use-whitelisted-validators";
import { getYieldOpportunity } from "./use-yield-opportunity/get-yield-opportunity";

export const useActivityActions = () => {
  const { address, network, isLedgerLive } = useSKWallet();
  const queryClient = useSKQueryClient();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

  const query = useInfiniteQuery({
    enabled: !!address && !!network,
    queryKey: getActionListQueryKey({
      network: network!,
      walletAddress: address!,
    }),
    queryFn: async ({ pageParam = 1 }) => {
      return (
        await EitherAsync(() =>
          actionList({
            page: pageParam,
            walletAddress: address!,
            network: network!,
            sort: "createdAtDesc",
          })
        )
          .mapLeft(() => new Error("Could not get action list"))
          .map((actionList) => ({
            ...actionList,
            data: actionList.data.filter(
              (x) => x.status !== ActionStatus.CREATED
            ),
          }))
          .chain(async (actionList) =>
            EitherAsync.all(
              (actionList.data as ActionList200["data"]).map((action) =>
                getYieldOpportunity({
                  yieldId: action.integrationId,
                  queryClient,
                  isLedgerLive,
                  whitelistedValidatorAddresses,
                })
                  .map((yieldData) => ({
                    actionData: action as typeof action & ActionDto,
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
