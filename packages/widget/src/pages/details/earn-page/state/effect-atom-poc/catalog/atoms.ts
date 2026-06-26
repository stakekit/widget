import BigNumber from "bignumber.js";
import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { config } from "../../../../../../config";
import { tokenString } from "../../../../../../domain";
import type { Networks } from "../../../../../../domain/types/chains/networks";
import {
  type BalanceDataKey,
  getPositionBalanceDataKey,
  type PositionsData,
  type YieldBalanceDto,
  type YieldBalancesByYieldDto,
} from "../../../../../../domain/types/positions";
import type { TokenBalanceScanDto } from "../../../../../../domain/types/token-balance";
import type { TokenDto } from "../../../../../../domain/types/tokens";
import {
  type DashboardYieldCategory,
  getApiYieldTypesForDashboardCategory,
  isNonZeroRewardRateYield,
} from "../../../../../../domain/types/yields";
import type {
  BalancesRequestDto,
  ValidatorDto,
  YieldDto,
} from "../../../../../../generated/api/yield";
import { StakeKitApiService, widgetAtomRuntime } from "../runtime";
import {
  EarnCatalogError,
  type EarnCatalogOperation,
  type EarnCatalogUnderlyingError,
  type EarnTokenOption,
  type EarnTokenOptionsState,
  type EarnValidatorsPullParams,
} from "../types";
import {
  type AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitTokenOptionKey,
  InitYieldKey,
  type PositionsDataKey,
  TokenBalancesScanKey,
  type TokenOptionsKey,
  type YieldCatalogKey,
  type YieldValidatorsKey,
} from "./keys";
import { loadAllPages } from "./utilities";

const catalogSWR = Atom.swr({
  staleTime: config.queryClient.staleTime,
  revalidateOnMount: true,
});

const DEFAULT_PAGE_SIZE = 100;
const PREFERRED_PAGE_CONCURRENCY = 5;

const toCatalogError =
  (operation: EarnCatalogOperation) => (cause: EarnCatalogUnderlyingError) =>
    new EarnCatalogError({ operation, cause });

const withCatalogError =
  (operation: EarnCatalogOperation) =>
  <A, E extends EarnCatalogUnderlyingError, R>(
    effect: Effect.Effect<A, E, R>
  ) =>
    effect.pipe(Effect.mapError(toCatalogError(operation)));

const mapCatalogStreamError =
  (operation: EarnCatalogOperation) =>
  <A, E extends EarnCatalogUnderlyingError, R>(
    stream: Stream.Stream<A, E, R>
  ) =>
    stream.pipe(Stream.mapError(toCatalogError(operation)));

const toNetworksParam = (network: Networks | null) =>
  network ? ([network] as const) : undefined;

const toYieldTypesParam = (category: DashboardYieldCategory | null) =>
  category ? getApiYieldTypesForDashboardCategory(category) : undefined;

const shouldUseYieldTokensApi = ({
  category,
  tokensForEnabledYieldsOnly,
}: {
  category: DashboardYieldCategory | null;
  tokensForEnabledYieldsOnly: boolean;
}) => tokensForEnabledYieldsOnly || !!toYieldTypesParam(category)?.length;

const getNextOffset = ({
  itemsLength,
  limit,
  offset,
  total,
}: {
  itemsLength: number;
  limit: number;
  offset: number;
  total: number;
}) => {
  const nextOffset = offset + itemsLength;
  return nextOffset < total && itemsLength >= limit
    ? Option.some(nextOffset)
    : Option.none<number>();
};

const getBalanceValidators = (balance: YieldBalanceDto) =>
  balance.validators ?? (balance.validator ? [balance.validator] : []);

const toPositionsData = (balancesData: YieldBalancesByYieldDto[]) =>
  balancesData.reduce((acc, val) => {
    acc.set(val.yieldId, {
      yieldId: val.yieldId,
      rewardRate: val.rewardRate,
      balanceData: [...val.balances]
        .sort((a, b) =>
          getPositionBalanceDataKey(a).localeCompare(
            getPositionBalanceDataKey(b)
          )
        )
        .reduce(
          (acc, balance) => {
            const key = getPositionBalanceDataKey(balance);
            const prev = acc.get(key);
            const validators = getBalanceValidators(balance);

            if (prev) {
              prev.balances.push(balance);
            } else if (key === "default") {
              acc.set(key, {
                balances: [balance],
                type: "default",
              });
            } else {
              acc.set(key, {
                balances: [balance],
                type: "validators",
                validators,
              });
            }

            return acc;
          },
          new Map<
            BalanceDataKey,
            { balances: YieldBalanceDto[] } & (
              | {
                  type: "validators";
                  validators: NonNullable<YieldBalanceDto["validators"]>;
                }
              | { type: "default" }
            )
          >()
        ),
    });

    return acc;
  }, new Map() as PositionsData);

export const availableYieldCategoriesAtom = Atom.family(
  (key: AvailableYieldCategoriesKey) =>
    widgetAtomRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* StakeKitApiService;

          const availability = yield* Effect.all(
            key.categoryOrder.map((category) =>
              Effect.gen(function* () {
                const response = yield* api.yield.YieldsControllerGetYields({
                  params: {
                    ...(key.network && { network: key.network }),
                    limit: DEFAULT_PAGE_SIZE,
                    types: getApiYieldTypesForDashboardCategory(category),
                  },
                });

                const hasVisibleYield = (response.items ?? []).some(
                  (yieldDto) =>
                    yieldDto.status.enter && isNonZeroRewardRateYield(yieldDto)
                );

                return hasVisibleYield ? category : null;
              })
            ),
            { concurrency: PREFERRED_PAGE_CONCURRENCY }
          );

          return availability.filter(
            (category): category is DashboardYieldCategory => category !== null
          );
        }).pipe(withCatalogError("available-yield-categories"))
      )
      .pipe(catalogSWR)
);

export const earnYieldCatalogAtom = Atom.family((key: YieldCatalogKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* StakeKitApiService;

        return yield* loadAllPages({
          concurrency: PREFERRED_PAGE_CONCURRENCY,
          fetchPage: (offset: number) =>
            api.yield.YieldsControllerGetYields({
              params: {
                limit: DEFAULT_PAGE_SIZE,
                offset,
                types: toYieldTypesParam(key.category),
                network: key.selectedToken.token.network,
                yieldIds: key.selectedToken.availableYields,
              },
            }),
          pageSize: DEFAULT_PAGE_SIZE,
        });
      }).pipe(withCatalogError("earn-yield-catalog"))
    )
    .pipe(catalogSWR)
);

export const initYieldAtom = Atom.family((key: InitYieldKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) {
          return null;
        }

        const api = yield* StakeKitApiService;

        return yield* api.yield.YieldsControllerGetYield(
          key.yieldId,
          undefined
        );
      }).pipe(withCatalogError("init-yield"))
    )
    .pipe(catalogSWR)
);

export const positionsDataAtom = Atom.family((key: PositionsDataKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.network) {
          return new Map() as PositionsData;
        }

        const api = yield* StakeKitApiService;
        const response = yield* api.yield.YieldsControllerGetAggregateBalances({
          payload: {
            queries: [
              {
                address: key.address,
                network:
                  key.network as BalancesRequestDto["queries"][number]["network"],
              },
            ],
          },
        });

        return toPositionsData(response.items as YieldBalancesByYieldDto[]);
      }).pipe(withCatalogError("positions-data"))
    )
    .pipe(catalogSWR)
);

const toDefaultTokenOption = (tokenWithYields: {
  readonly token: TokenDto;
  readonly availableYields: ReadonlyArray<string>;
}): EarnTokenOption => ({
  token: tokenWithYields.token,
  availableYields: tokenWithYields.availableYields,
  amount: "0",
  source: "default",
});

const toBalanceTokenOption = (tokenBalance: {
  readonly token: TokenDto;
  readonly availableYields: ReadonlyArray<string>;
  readonly amount: string;
}): EarnTokenOption => ({
  token: tokenBalance.token,
  availableYields: tokenBalance.availableYields,
  amount: tokenBalance.amount,
  source: "balance",
});

const toInitTokenOption = (tokenWithYields: {
  readonly token: TokenDto;
  readonly availableYields: ReadonlyArray<string>;
}): EarnTokenOption => ({
  token: tokenWithYields.token,
  availableYields: tokenWithYields.availableYields,
  amount: "0",
  source: "init",
});

const toInitYieldTokenOption = (yieldDto: YieldDto): EarnTokenOption => ({
  token: yieldDto.token,
  availableYields: [yieldDto.id],
  amount: "0",
  source: "init",
});

const findInitTokenOption = ({
  network,
  token,
  tokenOptions,
}: {
  network: Networks | null;
  token: string;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) =>
  tokenOptions.find((option) => {
    const tokenSymbolCompare =
      token.toLowerCase() === option.token.symbol.toLowerCase();
    const tokenNetworkCompare =
      !!network && network.toLowerCase() === option.token.network.toLowerCase();
    const tokenStringCompare = tokenString(option.token) === token;

    return (tokenSymbolCompare && tokenNetworkCompare) || tokenStringCompare;
  }) ?? null;

const defaultTokenOptionsPullAtom = Atom.family((key: DefaultTokenOptionsKey) =>
  widgetAtomRuntime.pull(() =>
    Stream.paginate(0, (offset) =>
      Effect.gen(function* () {
        const api = yield* StakeKitApiService;

        if (
          shouldUseYieldTokensApi({
            category: key.category,
            tokensForEnabledYieldsOnly: key.tokensForEnabledYieldsOnly,
          })
        ) {
          const response = yield* api.yield.TokensControllerGetTokens({
            params: {
              limit: DEFAULT_PAGE_SIZE,
              offset,
              networks: toNetworksParam(key.network),
              yieldTypes: toYieldTypesParam(key.category),
            },
          });
          const items = (response.items ?? []).map(toDefaultTokenOption);

          return [
            items,
            getNextOffset({
              itemsLength: response.items?.length ?? 0,
              limit: response.limit,
              offset: response.offset,
              total: response.total,
            }),
          ] as const;
        }

        if (offset > 0) {
          return [[], Option.none<number>()] as const;
        }

        const response = yield* api.legacy.TokenControllerGetTokens({
          params: {
            network: key.network ?? undefined,
          },
        });

        return [
          response.map(toDefaultTokenOption),
          Option.none<number>(),
        ] as const;
      })
    ).pipe(mapCatalogStreamError("default-token-options"))
  )
);

const initTokenOptionAtom = Atom.family((key: InitTokenOptionKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.token) {
          return null;
        }

        const api = yield* StakeKitApiService;
        const response = yield* api.legacy.TokenControllerGetTokens({
          params: {
            network: key.network ?? undefined,
          },
        });

        return findInitTokenOption({
          network: key.network,
          token: key.token,
          tokenOptions: response.map(toInitTokenOption),
        });
      }).pipe(withCatalogError("init-token-option"))
    )
    .pipe(catalogSWR)
);

const tokenBalancesScanAtom = Atom.family((key: TokenBalancesScanKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.network) {
          return [];
        }

        const api = yield* StakeKitApiService;
        const response = yield* api.legacy.TokenControllerTokenBalancesScan({
          payload: {
            addresses: {
              address: key.address,
              additionalAddresses: key.additionalAddresses ?? undefined,
            },
            network: key.network as TokenBalanceScanDto["network"],
          },
        });

        return response.map(toBalanceTokenOption);
      }).pipe(withCatalogError("token-balances-scan"))
    )
    .pipe(catalogSWR)
);

const getTokenOptionRank = (token: EarnTokenOption) => {
  if (token.source === "balance") {
    return new BigNumber(token.amount).isGreaterThan(0) ? 0 : 2;
  }

  if (token.source === "init") {
    return 1;
  }

  return 3;
};

const mergeTokenOptions = ({
  balanceItems,
  defaultItems,
  initItems,
}: {
  balanceItems: ReadonlyArray<EarnTokenOption>;
  defaultItems: ReadonlyArray<EarnTokenOption>;
  initItems: ReadonlyArray<EarnTokenOption>;
}) => {
  const mergeAvailableYields = (
    prev: EarnTokenOption | undefined,
    next: EarnTokenOption
  ) => [
    ...new Set([...(prev?.availableYields ?? []), ...next.availableYields]),
  ];

  const mergeOption = (
    prev: { option: EarnTokenOption } | undefined,
    next: EarnTokenOption
  ): EarnTokenOption => ({
    ...next,
    availableYields: mergeAvailableYields(prev?.option, next),
  });

  const byKey = new Map<
    string,
    {
      balanceIndex: number | null;
      defaultIndex: number | null;
      initIndex: number | null;
      option: EarnTokenOption;
    }
  >();

  defaultItems.forEach((option, defaultIndex) => {
    byKey.set(tokenString(option.token), {
      balanceIndex: null,
      defaultIndex,
      initIndex: null,
      option: mergeOption(undefined, option),
    });
  });

  initItems.forEach((option, initIndex) => {
    const key = tokenString(option.token);
    const prev = byKey.get(key);

    byKey.set(key, {
      balanceIndex: null,
      defaultIndex: prev?.defaultIndex ?? null,
      initIndex,
      option: mergeOption(prev, option),
    });
  });

  balanceItems.forEach((option, balanceIndex) => {
    const key = tokenString(option.token);
    const prev = byKey.get(key);

    byKey.set(key, {
      balanceIndex,
      defaultIndex: prev?.defaultIndex ?? null,
      initIndex: prev?.initIndex ?? null,
      option: mergeOption(prev, option),
    });
  });

  return [...byKey.values()]
    .sort((a, b) => {
      const rankDiff =
        getTokenOptionRank(a.option) - getTokenOptionRank(b.option);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return (
        (a.balanceIndex ??
          a.initIndex ??
          a.defaultIndex ??
          Number.MAX_SAFE_INTEGER) -
        (b.balanceIndex ??
          b.initIndex ??
          b.defaultIndex ??
          Number.MAX_SAFE_INTEGER)
      );
    })
    .map(({ option }) => option);
};

export const mergedTokenOptionsAtom = Atom.family((key: TokenOptionsKey) => {
  const defaultTokenOptionsAtom = defaultTokenOptionsPullAtom(
    new DefaultTokenOptionsKey({
      category: key.category,
      network: key.network,
      tokensForEnabledYieldsOnly: key.tokensForEnabledYieldsOnly,
    })
  );
  const tokenBalancesAtom = tokenBalancesScanAtom(
    new TokenBalancesScanKey({
      address: key.address,
      additionalAddresses: key.additionalAddresses,
      network: key.network,
    })
  );
  const initTokenAtom = initTokenOptionAtom(
    new InitTokenOptionKey({
      token: key.initToken,
      network: key.initTokenNetwork,
    })
  );
  const initYieldAtomValue = initYieldAtom(
    new InitYieldKey({ yieldId: key.initYieldId })
  );

  return Atom.make<EarnTokenOptionsState>((context) => {
    const defaultResult = context.get(defaultTokenOptionsAtom);
    const balancesResult = context.get(tokenBalancesAtom);
    const initTokenResult = context.get(initTokenAtom);
    const initYieldResult = context.get(initYieldAtomValue);
    const defaultItems = defaultResult.pipe(
      AsyncResult.value,
      Option.map((value) => value.items),
      Option.getOrElse(() => [])
    );
    const balanceItems = balancesResult.pipe(
      AsyncResult.value,
      Option.getOrElse(() => [])
    );
    const initYield = initYieldResult.pipe(AsyncResult.value, Option.getOrNull);
    const initToken = initTokenResult.pipe(AsyncResult.value, Option.getOrNull);
    const initItems = [
      initYield ? toInitYieldTokenOption(initYield) : null,
      initToken,
    ].filter((option): option is EarnTokenOption => option !== null);

    return {
      defaultResult,
      balancesResult,
      initTokenResult,
      initYieldResult,
      defaultItems,
      balanceItems,
      initItems,
      items: mergeTokenOptions({ balanceItems, defaultItems, initItems }),
    };
  });
});

export const tokenOptionsPullAtom = defaultTokenOptionsPullAtom;

export const yieldValidatorsAtom = Atom.family(
  ({ selectedYieldId }: YieldValidatorsKey) => {
    const preferredValidatorsAtom = widgetAtomRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* StakeKitApiService;

          const preferredValidators = yield* loadAllPages({
            concurrency: PREFERRED_PAGE_CONCURRENCY,
            fetchPage: (offset: number) =>
              api.yield.YieldsControllerGetYieldValidators(selectedYieldId, {
                params: {
                  limit: DEFAULT_PAGE_SIZE,
                  offset,
                  preferred: true,
                },
              }),
            pageSize: DEFAULT_PAGE_SIZE,
          });

          return preferredValidators;
        }).pipe(withCatalogError("preferred-validators"))
      )
      .pipe(catalogSWR);

    const loadedValidatorsAtom = Atom.writable<
      Map<ValidatorDto["address"], ValidatorDto>,
      ReadonlyArray<ValidatorDto>
    >(
      (context) => {
        const preferredValidators = context.get(preferredValidatorsAtom).pipe(
          AsyncResult.value,
          Option.getOrElse(() => [])
        );

        return new Map([
          ...preferredValidators.map(
            (validator) => [validator.address, validator] as const
          ),
        ]);
      },
      (context, value) => {
        const newValue = new Map(context.get(loadedValidatorsAtom));

        value.forEach((validator) => {
          newValue.set(validator.address, validator);
        });

        context.setSelf(newValue);
      }
    );

    /**
     * If search is provided, we search all preferred and non-preferred validators
     * If search is not provided, we search only non-preferred validators
     */
    const validatorsPullAtom = Atom.family(
      ({ search }: EarnValidatorsPullParams) =>
        widgetAtomRuntime.pull(
          (context) => {
            return Stream.paginate(0, (offset) =>
              Effect.gen(function* () {
                const api = yield* StakeKitApiService;
                const response =
                  yield* api.yield.YieldsControllerGetYieldValidators(
                    selectedYieldId,
                    {
                      params: {
                        limit: DEFAULT_PAGE_SIZE,
                        name: search || undefined,
                        address: search || undefined,
                        offset,
                        ...(search ? { preferred: false } : {}),
                      },
                    }
                  );
                const items = response.items ?? [];

                context.set(loadedValidatorsAtom, items);

                return [
                  items,
                  getNextOffset({
                    itemsLength: items.length,
                    limit: response.limit,
                    offset: response.offset,
                    total: response.total,
                  }),
                ] as const;
              })
            ).pipe(mapCatalogStreamError("validators"));
          },
          { initialValue: [] }
        )
    );

    return {
      loadedValidatorsAtom,
      preferredValidatorsAtom,
      validatorsPullAtom,
    };
  }
);
