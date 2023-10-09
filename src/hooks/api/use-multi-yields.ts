import { useSKWallet } from "../wallet/use-sk-wallet";
import {
  APIManager,
  YieldDto,
  getYieldYieldOpportunityQueryKey,
  yieldYieldOpportunity,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import { createSelector } from "reselect";
import { SKWallet } from "../../domain/types";
import { isSupportedChain } from "../../domain/types/chains";
import { withRequestErrorRetry } from "../../common/utils";
import { eitherAsyncPool } from "../../utils/either-async-pool";

const getMultiYieldsQueryKey = (yieldIds: string[]) => [
  "multi-yields",
  yieldIds,
];

export const useMultiYields = (yieldIds: string[]) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();

  return useQuery<YieldDto[], Error>({
    queryKey: getMultiYieldsQueryKey(yieldIds),
    enabled: yieldIds.length > 0,
    queryFn: async ({ signal }) => {
      const res = eitherAsyncPool(
        yieldIds.map(
          (y) => () =>
            withRequestErrorRetry({
              fn: () =>
                yieldYieldOpportunity(
                  y,
                  { ledgerWalletAPICompatible: isLedgerLive },
                  signal
                ),
            }).mapLeft(() => new Error("Unknown error"))
        ),
        5
      )()
        .map((data) =>
          defaultFiltered({ data, isConnected, network, isLedgerLive })
        )
        .ifRight((data) => {
          const queryClient = APIManager.getQueryClient();

          /**
           * Set the query data for each yield opportunity
           */
          data.forEach(
            (y) =>
              queryClient?.setQueryData(
                getYieldYieldOpportunityQueryKey(y.id, {
                  ledgerWalletAPICompatible: isLedgerLive,
                }),
                y
              )
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
