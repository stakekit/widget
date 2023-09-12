import { useSKWallet } from "../../wallet/use-sk-wallet";
import {
  YieldDto,
  YieldYields200,
  YieldYieldsParams,
  getYieldYieldsQueryKey,
  yieldYields,
} from "@stakekit/api-hooks";
import {
  UseInfiniteQueryOptions,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { createSelector } from "reselect";
import { SKWallet } from "../../../domain/types";
import { isSupportedChain } from "../../../domain/types/chains";
import { EitherAsync } from "purify-ts";

export const useYields = (opts?: UseInfiniteQueryOptions<YieldYields200>) => {
  const { network, isReconnecting, isConnected } = useSKWallet();

  const params: YieldYieldsParams = {
    network: network ?? undefined,
  };

  return useInfiniteQuery<YieldYields200>({
    queryKey: getYieldYieldsQueryKey(params),
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    queryFn: async ({ pageParam = 1 }) =>
      await EitherAsync(() =>
        yieldYields({
          sortBy: "relevantYieldType",
          page: pageParam,
          limit: 50,
          network: network ?? undefined,
        })
      )
        .map((val) => ({
          ...val,
          data: defaultFiltered({ data: val.data, isConnected, network }),
        }))
        .caseOf({
          Left(l) {
            return Promise.reject(l);
          },
          Right(r) {
            return Promise.resolve(r);
          },
        }),
    enabled: isConnected && !isReconnecting,
    ...opts,
  });
};

type SelectorInputData = {
  data: YieldDto[];
  isConnected: boolean;
  network: SKWallet["network"];
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
  (data, isConnected, network) => {
    return data.filter((o) => skFilter({ o, isConnected, network }));
  }
);
