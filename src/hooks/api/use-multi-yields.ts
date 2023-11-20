import { YieldDto } from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import { createSelector } from "reselect";
import { SKWallet } from "../../domain/types";
import { isSupportedChain } from "../../domain/types/chains";
import { eitherAsyncPool } from "../../utils/either-async-pool";
import {
  getYieldOpportunity,
  setYieldOpportunityInCache,
} from "./use-yield-opportunity";
import { config } from "../../config";
import { useSKWallet } from "../../providers/sk-wallet";

const getMultiYieldsQueryKey = (yieldIds: string[]) => [
  "multi-yields",
  yieldIds,
];

export const useMultiYields = (yieldIds: string[]) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();

  return useQuery<YieldDto[], Error>({
    queryKey: getMultiYieldsQueryKey(yieldIds),
    enabled: !!yieldIds.length,
    staleTime: config.queryClient.cacheTime,
    queryFn: async ({ signal }) => {
      const res = eitherAsyncPool(
        yieldIds.map(
          (y) => () => getYieldOpportunity({ isLedgerLive, yieldId: y, signal })
        ),
        5
      )()
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
            })
          );
        });

      return res.caseOf({
        Left: (e) => {
          console.log(e);
          return Promise.reject(e);
        },
        Right: (data) => Promise.resolve(data),
      });
    },
  });
};

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
