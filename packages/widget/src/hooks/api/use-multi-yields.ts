import type { YieldDto } from "@stakekit/api-hooks";
import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import type { QueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe, Right } from "purify-ts";
import { createSelector } from "reselect";
import { config } from "../../config";
import type { SKWallet } from "../../domain/types";
import { isSupportedChain } from "../../domain/types/chains";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { eitherAsyncPool } from "../../utils/either-async-pool";
import {
  getYieldOpportunity,
  setYieldOpportunityInCache,
} from "./use-yield-opportunity";

const getMultiYieldsQueryKey = (yieldIds: string[]) => [
  "multi-yields",
  yieldIds,
];

export const getCachedMultiYields = ({
  queryClient,
  yieldIds,
}: {
  queryClient: QueryClient;
  yieldIds: string[];
}) =>
  Maybe.fromNullable(
    queryClient.getQueryData<YieldDto[]>(getMultiYieldsQueryKey(yieldIds))
  );

export const useMultiYields = <SelectData = YieldDto[]>(
  yieldIds: string[],
  opts?: { select?: UseQueryOptions<YieldDto[], Error, SelectData>["select"] }
) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();

  const queryClient = useSKQueryClient();

  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery<YieldDto[], Error, SelectData>({
    queryKey: getMultiYieldsQueryKey(yieldIds),
    enabled: !!yieldIds.length,
    staleTime: config.queryClient.cacheTime,
    select: opts?.select,
    queryFn: async () =>
      (
        await queryFn({
          isConnected,
          isLedgerLive,
          network,
          queryClient,
          yieldIds,
          yieldYieldOpportunity,
        })
      ).unsafeCoerce(),
  });
};

export const getMultipleYields = (
  params: Parameters<typeof queryFn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getMultiYieldsQueryKey(params.yieldIds),
      queryFn: async () => (await queryFn(params)).unsafeCoerce(),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get multi yields");
  });

const queryFn = ({
  yieldIds,
  isLedgerLive,
  queryClient,
  isConnected,
  network,
  yieldYieldOpportunity,
}: {
  isLedgerLive: boolean;
  yieldIds: string[];
  queryClient: QueryClient;
  isConnected: boolean;
  network: SKWallet["network"];
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
}) =>
  eitherAsyncPool(
    yieldIds.map(
      (y) => () =>
        getYieldOpportunity({
          isLedgerLive,
          yieldId: y,
          queryClient,
          yieldYieldOpportunity,
        }).chainLeft(async () => Right(null))
    ),
    5
  )()
    .map((val) => val.filter((v): v is NonNullable<typeof v> => !!v))
    .map((data) =>
      defaultFiltered({ data, isConnected, network, isLedgerLive })
    )
    .ifRight((data) => {
      /**
       * Set the query data for each yield opportunity
       */
      data.forEach((y) =>
        setYieldOpportunityInCache({
          isLedgerLive,
          yieldDto: y,
          queryClient,
        })
      );
    });

type SelectorInputData = {
  data: YieldDto[];
  isConnected: boolean;
  network: SKWallet["network"];
  isLedgerLive: boolean;
};

const skFilter = ({
  o,
  isConnected,
  network,
}: {
  o: YieldDto;
  isConnected: boolean;
  network: SKWallet["network"];
}) => {
  const defaultFilter =
    !o.args.enter.args?.nfts &&
    o.id !== "binance-bnb-native-staking" &&
    o.id !== "binance-testnet-bnb-native-staking" &&
    o.id !== "avax-native-staking" &&
    o.status.enter &&
    isSupportedChain(o.token.network);

  if (!isConnected) return defaultFilter;

  return network === o.token.network && defaultFilter;
};

const selectData = (val: SelectorInputData) => val.data;
const selectConnected = (val: SelectorInputData) => val.isConnected;
const selectNetwork = (val: SelectorInputData) => val.network;

const defaultFiltered = createSelector(
  selectData,
  selectConnected,
  selectNetwork,
  (data, isConnected, network) =>
    data.filter((o) => skFilter({ o, isConnected, network }))
);
