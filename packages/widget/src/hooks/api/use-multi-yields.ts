import { hashKey, type QueryClient, useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import { createStore } from "@xstate/store";
import type BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useEffect, useMemo } from "react";
import { createSelector } from "reselect";
import {
  defaultIfEmpty,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Observable,
  of,
  repeat,
  take,
  tap,
  timer,
  toArray,
} from "rxjs";
import { tokenString } from "../../domain";
import {
  isSupportedChain,
  type SupportedSKChains,
} from "../../domain/types/chains";
import type { InitParams } from "../../domain/types/init-params";
import type { PositionsData } from "../../domain/types/positions";
import {
  canBeInitialYield,
  type PreferredTokenYieldsPerNetwork,
} from "../../domain/types/stake";
import type { SKWallet } from "../../domain/types/wallet";
import {
  type DashboardYieldCategory,
  getDashboardYieldCategory,
  isNonZeroRewardRateYield,
  type ValidatorsConfig,
  type Yield,
  type YieldBase,
} from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSavedRef } from "../use-saved-ref";
import { useValidatorsConfig } from "../use-validators-config";
import {
  getYieldOpportunities,
  getYieldOpportunityFromSummary,
} from "./use-yield-opportunity/get-yield-opportunity";
import {
  fetchYieldSummariesWithProvidersByIds,
  type YieldSummaryWithProvider,
} from "./use-yield-summaries";

const multiYieldsStore = createStore({
  context: { data: new Map<string, Map<string, YieldSummaryWithProvider>>() },
  on: {
    "yield-opportunity": (
      context,
      event: { data: { key: string; yieldDto: YieldSummaryWithProvider } }
    ) => {
      const newMap = new Map(context.data);
      const prev = newMap.get(event.data.key) ?? new Map();

      prev.set(event.data.yieldDto.id, event.data.yieldDto);
      newMap.set(event.data.key, prev);

      return { data: newMap };
    },
  },
});

export const useStreamYieldSummaries = (yieldIds: ReadonlyArray<string>) => {
  const { network, isConnected, isLedgerLive } = useSKWallet();
  const apiClient = useApiClient();

  const argsRef = useSavedRef({
    isLedgerLive,
    queryClient: useSKQueryClient(),
    apiClient,
    network,
    isConnected,
  });

  const hashedKey = useMemo(() => hashKey(yieldIds), [yieldIds]);

  const validatorsConfig = useValidatorsConfig();

  useEffect(() => {
    const sub = multipleYieldSummaries$({
      ...argsRef.current,
      yieldIds,
      validatorsConfig,
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
  }, [argsRef, yieldIds, hashedKey, validatorsConfig]);

  return useSelector(multiYieldsStore, (state) => {
    const map = state.context.data.get(hashedKey);

    return map ? Array.from(map.values()) : [];
  });
};

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

export const getFirstEligibleYield = (
  params: Parameters<typeof firstEligibleYield$>[0]
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getFirstEligibleYieldQueryKey({
        yieldIds: params.yieldIds,
        dashboardYieldCategory: params.dashboardYieldCategory,
      }),
      queryFn: () => firstValueFrom(firstEligibleYield$(params)),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get first eligible yield");
  });

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

const multipleYieldSummaries$ = (args: {
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
        fetchYieldSummariesWithProvidersByIds({
          apiClient: args.apiClient,
          queryClient: args.queryClient,
          yieldIds: args.yieldIds,
        })
      ).pipe(
        mergeMap((v) => from(v)),
        filter(
          (v): v is YieldSummaryWithProvider =>
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
  apiClient: ReturnType<typeof useApiClient>;
  isConnected: boolean;
  network: SKWallet["network"];
  yieldIds: ReadonlyArray<string>;
  dashboardYieldCategory?: DashboardYieldCategory | null;
  initParams: InitParams;
  positionsData: PositionsData;
  tokenBalanceAmount: BigNumber;
  validatorsConfig: ValidatorsConfig;
  preferredTokenYieldsPerNetwork: PreferredTokenYieldsPerNetwork | null;
}) => {
  let defaultYield: YieldSummaryWithProvider | null = null;

  const successStream = multipleYieldSummaries$(args).pipe(
    filter(
      (y) =>
        !args.dashboardYieldCategory ||
        getDashboardYieldCategory(y) === args.dashboardYieldCategory
    ),
    tap((v) => {
      if (isNonZeroRewardRateYield(v) || !defaultYield) {
        defaultYield = v;
      }
    }),
    filter((y) => {
      const preferredYieldId = Maybe.fromNullable(
        args.preferredTokenYieldsPerNetwork?.[
          y.token.network as SupportedSKChains
        ]?.[tokenString(y.token)]
      )
        .altLazy(() =>
          Maybe.fromNullable(args.preferredTokenYieldsPerNetwork).chainNullable(
            (v) => Object.values(v)[0][tokenString(y.token)]
          )
        )
        .extractNullable();

      if (preferredYieldId) {
        return y.id === preferredYieldId || preferredYieldId === "*";
      }

      return canBeInitialYield({
        initQueryParams: Maybe.fromNullable(args.initParams),
        yieldDto: y,
        tokenBalanceAmount: args.tokenBalanceAmount,
        positionsData: args.positionsData,
      });
    }),
    take(1),
    defaultIfEmpty(null),
    mergeMap((yieldSummary) => {
      const selectedYield = yieldSummary ?? defaultYield;

      if (!selectedYield) {
        return of(null);
      }

      return from(
        getYieldOpportunityFromSummary({
          isLedgerLive: args.isLedgerLive,
          yieldDto: selectedYield,
          queryClient: args.queryClient,
          apiClient: args.apiClient,
        })
      ).pipe(map((v) => (v.isRight() ? v.extract() : null)));
    })
  );

  return new Observable<Yield | null>((subscriber) => {
    successStream.subscribe({
      complete: () => subscriber.complete(),
      next: (v) => subscriber.next(v),
      error: (e) => subscriber.error(e),
    });
  });
};

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

const getFirstEligibleYieldQueryKey = ({
  yieldIds,
  dashboardYieldCategory,
}: {
  yieldIds: ReadonlyArray<string>;
  dashboardYieldCategory?: DashboardYieldCategory | null;
}) => ["first-eligible-yield", yieldIds, dashboardYieldCategory ?? null];

export const getCachedFirstEligibleYield = ({
  queryClient,
  yieldIds,
  dashboardYieldCategory,
}: {
  queryClient: QueryClient;
  yieldIds: ReadonlyArray<string>;
  dashboardYieldCategory?: DashboardYieldCategory | null;
}) =>
  Maybe.fromNullable(
    queryClient.getQueryData<Yield>(
      getFirstEligibleYieldQueryKey({ yieldIds, dashboardYieldCategory })
    )
  );
