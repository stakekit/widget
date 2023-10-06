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
import { EitherAsync } from "purify-ts";
import { withRequestErrorRetry } from "../../common/utils";

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
      const results: YieldDto[] = [];

      // Chunk the requests into groups of 5
      for (let i = 0; i < yieldIds.length; i += 5) {
        const reqs: EitherAsync<Error, YieldDto>[] = [];

        for (let j = i; j < i + 5 && j < yieldIds.length; j++) {
          reqs.push(
            withRequestErrorRetry({
              fn: () =>
                yieldYieldOpportunity(
                  yieldIds[j],
                  { ledgerWalletAPICompatible: isLedgerLive },
                  signal
                ),
            }).mapLeft(() => new Error("Unknown error"))
          );
        }

        const sliceRes = await EitherAsync.all(reqs);

        if (sliceRes.isLeft()) {
          return Promise.reject(sliceRes.extract());
        }

        sliceRes.ifRight((data) =>
          results.push(
            ...defaultFiltered({ data, isConnected, network, isLedgerLive })
          )
        );
      }

      const queryClient = APIManager.getQueryClient();

      /**
       * Set the query data for each yield opportunity
       */
      results.forEach(
        (y) =>
          queryClient?.setQueryData(
            getYieldYieldOpportunityQueryKey(y.id, {
              ledgerWalletAPICompatible: isLedgerLive,
            }),
            y
          )
      );

      return results;
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
