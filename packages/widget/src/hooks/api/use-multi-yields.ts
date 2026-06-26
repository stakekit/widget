import { type QueryClient, useQuery } from "@tanstack/react-query";
import { createSelector } from "reselect";
import {
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  toArray,
} from "rxjs";
import { isSupportedChain } from "../../domain/types/chains";
import type { SKWallet } from "../../domain/types/wallet";
import type {
  ValidatorsConfig,
  Yield,
  YieldBase,
} from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSavedRef } from "../use-saved-ref";
import { useValidatorsConfig } from "../use-validators-config";
import { getYieldOpportunities } from "./use-yield-opportunity/get-yield-opportunity";

export const useMultiYields = <T = Yield[]>(
  yieldIds: ReadonlyArray<string>,
  opts?: {
    select?: (val: Yield[]) => T;
    enabled?: boolean;
  }
) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();
  const apiClient = useApiClient();

  const validatorsConfig = useValidatorsConfig();

  const argsRef = useSavedRef({
    isLedgerLive,
    queryClient: useSKQueryClient(),
    apiClient,
    network,
    isConnected,
  });

  return useQuery({
    enabled: yieldIds.length > 0 && opts?.enabled,
    queryKey: ["multi-yields", yieldIds, validatorsConfig],
    queryFn: () =>
      firstValueFrom(
        multipleYields$({
          ...argsRef.current,
          yieldIds,
          validatorsConfig,
        }).pipe(toArray())
      ),
    select: opts?.select,
  });
};

const multipleYields$ = (args: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  apiClient: ReturnType<typeof useApiClient>;
  isConnected: boolean;
  network: SKWallet["network"];
  yieldIds: ReadonlyArray<string>;
  validatorsConfig: ValidatorsConfig;
}) =>
  args.yieldIds.length === 0
    ? EMPTY
    : from(
        getYieldOpportunities({
          isLedgerLive: args.isLedgerLive,
          yieldIds: args.yieldIds,
          queryClient: args.queryClient,
          apiClient: args.apiClient,
        })
      ).pipe(
        map((v) => (v.isRight() ? v.extract() : [])),
        mergeMap((v) => from(v)),
        filter(
          (v): v is Yield =>
            !!(
              v &&
              defaultFiltered({
                data: [v],
                isConnected: args.isConnected,
                network: args.network,
                isLedgerLive: args.isLedgerLive,
              }).length > 0
            )
        )
      );

type SelectorInputData = {
  data: YieldBase[];
  isConnected: boolean;
  network: SKWallet["network"];
  isLedgerLive: boolean;
};

const selectData = (val: SelectorInputData) => val.data;
const selectConnected = (val: SelectorInputData) => val.isConnected;
const selectNetwork = (val: SelectorInputData) => val.network;

const defaultFiltered = createSelector(
  selectData,
  selectConnected,
  selectNetwork,
  (data, isConnected, network) =>
    data.filter((o) => {
      const defaultFilter =
        o.id !== "binance-bnb-native-staking" &&
        o.id !== "binance-testnet-bnb-native-staking" &&
        o.id !== "avax-native-staking" &&
        o.status.enter &&
        isSupportedChain(o.token.network);

      if (!isConnected) return defaultFilter;

      return network === o.token.network && defaultFilter;
    })
);
