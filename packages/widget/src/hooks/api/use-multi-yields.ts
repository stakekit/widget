import type { InitParams } from "@sk-widget/domain/types/init-params";
import type { PositionsData } from "@sk-widget/domain/types/positions";
import { canBeInitialYield } from "@sk-widget/domain/types/stake";
import { useSavedRef } from "@sk-widget/hooks/use-saved-ref";
import type { YieldDto } from "@stakekit/api-hooks";
import { type QueryClient, hashKey } from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import { createStore } from "@xstate/store";
import type { BigNumber } from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useEffect, useMemo } from "react";
import { createSelector } from "reselect";
import {
  Observable,
  defaultIfEmpty,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  repeat,
  take,
  tap,
  timer,
} from "rxjs";
import type { SKWallet } from "../../domain/types";
import { isSupportedChain } from "../../domain/types/chains";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { getYieldOpportunity } from "./use-yield-opportunity";

const multiYieldsStore = createStore({
  context: { data: new Map<string, Map<string, YieldDto>>() },
  on: {
    "yield-opportunity": (
      context,
      event: { data: { key: string; yieldDto: YieldDto } }
    ) => {
      const newMap = new Map(context.data);
      const prev = newMap.get(event.data.key) ?? new Map();

      prev.set(event.data.yieldDto.id, event.data.yieldDto);
      newMap.set(event.data.key, prev);

      return { data: newMap };
    },
  },
});

export const useMultiYields = (yieldIds: string[]) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();

  const argsRef = useSavedRef({
    isLedgerLive,
    queryClient: useSKQueryClient(),
    network,
    isConnected,
  });

  const hashedKey = useMemo(() => hashKey(yieldIds), [yieldIds]);

  useEffect(() => {
    const sub = multipleYields$({
      ...argsRef.current,
      yieldIds,
    })
      .pipe(repeat({ delay: () => timer(1000 * 60 * 2) }))
      .subscribe({
        next: (v) =>
          multiYieldsStore.send({
            type: "yield-opportunity",
            data: { yieldDto: v, key: hashedKey },
          }),
      });

    return () => sub.unsubscribe();
  }, [argsRef, yieldIds, hashedKey]);

  return useSelector(multiYieldsStore, (state) => {
    const map = state.context.data.get(hashedKey);

    return map ? Array.from(map.values()) : [];
  });
};

export const getFirstEligibleYield = (
  params: Parameters<typeof firstEligibleYield$>[0]
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getFirstEligibleYieldQueryKey(params.yieldIds),
      queryFn: () => firstValueFrom(firstEligibleYield$(params)),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get first eligible yield");
  });

const multipleYields$ = (args: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  isConnected: boolean;
  network: SKWallet["network"];
  yieldIds: string[];
}) =>
  merge(
    ...args.yieldIds.map((v) =>
      from(
        getYieldOpportunity({
          isLedgerLive: args.isLedgerLive,
          yieldId: v,
          queryClient: args.queryClient,
        })
      )
    )
  ).pipe(
    map((v) => (v.isRight() ? v.extract() : null)),
    filter(
      (v): v is YieldDto =>
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

const firstEligibleYield$ = (args: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  isConnected: boolean;
  network: SKWallet["network"];
  yieldIds: string[];
  initParams: InitParams;
  positionsData: PositionsData;
  tokenBalanceAmount: BigNumber;
}) => {
  let defaultYield: YieldDto | null = null;

  const successStream = multipleYields$(args).pipe(
    tap((v) => {
      defaultYield = v;
    }),
    filter((y) =>
      canBeInitialYield({
        initQueryParams: Maybe.fromNullable(args.initParams),
        yieldDto: y,
        tokenBalanceAmount: args.tokenBalanceAmount,
        positionsData: args.positionsData,
      })
    ),
    take(1),
    defaultIfEmpty(null)
  );

  return new Observable<YieldDto | null>((subscriber) => {
    successStream.subscribe({
      complete: () => subscriber.complete(),
      next: (v) => subscriber.next(v ?? defaultYield),
      error: (e) => subscriber.error(e),
    });
  });
};

type SelectorInputData = {
  data: YieldDto[];
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
        !o.args.enter.args?.nfts &&
        o.id !== "binance-bnb-native-staking" &&
        o.id !== "binance-testnet-bnb-native-staking" &&
        o.id !== "avax-native-staking" &&
        o.status.enter &&
        isSupportedChain(o.token.network);

      if (!isConnected) return defaultFilter;

      return network === o.token.network && defaultFilter;
    })
);

const getFirstEligibleYieldQueryKey = (yieldIds: string[]) => [
  "first-eligible-yield",
  yieldIds,
];

export const getCachedFirstEligibleYield = ({
  queryClient,
  yieldIds,
}: {
  queryClient: QueryClient;
  yieldIds: string[];
}) =>
  Maybe.fromNullable(
    queryClient.getQueryData<YieldDto>(getFirstEligibleYieldQueryKey(yieldIds))
  );
