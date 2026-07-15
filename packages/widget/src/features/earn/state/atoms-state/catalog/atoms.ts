import BigNumber from "bignumber.js";
import { Cause, Duration, Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../../app/runtime";
import { tokenString } from "../../../../../domain";
import type {
  EarnToken,
  EarnValidator,
  EarnValidatorKey,
  EarnYield,
} from "../../../../../domain/schema/earn-models";
import type { TokenBalanceScanCommand } from "../../../../../domain/schema/financial-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { Network } from "../../../../../domain/schema/network-model";
import {
  type PositionsData,
  toPositionsData,
} from "../../../../../domain/types/positions";
import {
  type DashboardYieldCategory,
  getApiYieldTypesForDashboardCategory,
  isNonZeroRewardRateYield,
} from "../../../../../domain/types/yields";
import { LegacyApiService } from "../../../../../services/api/legacy-api-service";
import { YieldApiService } from "../../../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../../../shared/effect/api-resource";
import {
  loadAllPages,
  paginatedApiStream,
} from "../../../../../shared/effect/pagination";
import {
  EarnCatalogError,
  type EarnCatalogOperation,
  type EarnCatalogUnderlyingError,
  type EarnTokenOption,
  type EarnTokenOptionsState,
  type EarnValidatorsResource,
} from "../types";
import {
  type AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitTokenOptionKey,
  InitYieldKey,
  type PositionsDataKey,
  TokenBalancesScanKey,
  type TokenOptionsKey,
  TokenYieldScopeKey,
  type YieldCatalogKey,
  type YieldValidatorsKey,
  type YieldValidatorsPullKey,
} from "./keys";
import { loadAllPagesByIdChunks } from "./utilities";

const catalogSWR = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
  idleTTL: Duration.minutes(5),
  revalidateOnMount: true,
});

const DEFAULT_PAGE_SIZE = 100;
const YIELD_IDS_CHUNK_SIZE = 100;
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

const toNetworksParam = (network: Network | null) =>
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

export const availableYieldCategoriesAtom = Atom.family(
  (key: AvailableYieldCategoriesKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* YieldApiService;

          const availability = yield* Effect.all(
            key.categoryOrder.map((category) =>
              Effect.gen(function* () {
                const page = yield* api.getAvailableYields({
                  ...(key.network && { network: key.network }),
                  limit: DEFAULT_PAGE_SIZE,
                  types: getApiYieldTypesForDashboardCategory(category),
                });
                const hasVisibleYield = (page.items ?? []).some(
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

export const earnYieldCatalogAtom = Atom.family((key: YieldCatalogKey) => {
  return appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* YieldApiService;

        return yield* loadAllPagesByIdChunks({
          chunkSize: YIELD_IDS_CHUNK_SIZE,
          concurrency: PREFERRED_PAGE_CONCURRENCY,
          fetchPage: ({ ids, offset }) =>
            api.getYields({
              limit: DEFAULT_PAGE_SIZE,
              offset,
              types: toYieldTypesParam(key.category),
              network: key.network,
              yieldIds: ids,
            }),
          getItemId: (yieldDto) => yieldDto.id,
          ids: key.yieldIds,
          pageSize: DEFAULT_PAGE_SIZE,
        });
      }).pipe(withCatalogError("earn-yield-catalog"))
    )
    .pipe(catalogSWR);
});

export const initYieldAtom = Atom.family((key: InitYieldKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) {
          return null;
        }

        const api = yield* YieldApiService;

        return yield* api.getInitialYield(key.yieldId);
      }).pipe(withCatalogError("init-yield"))
    )
    .pipe(catalogSWR)
);

export const positionsDataAtom = Atom.family((key: PositionsDataKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.network) {
          return new Map() as PositionsData;
        }

        const api = yield* YieldApiService;
        const positions = yield* api.getCatalogPositions({
          address: key.address,
          network: key.network,
        });

        return toPositionsData(positions.items);
      }).pipe(withCatalogError("positions-data"))
    )
    .pipe(catalogSWR)
);

const toDefaultTokenOption = (tokenWithYields: {
  readonly token: EarnToken;
  readonly availableYields: ReadonlyArray<YieldId>;
}): EarnTokenOption => ({
  token: tokenWithYields.token,
  availableYields: tokenWithYields.availableYields,
  amount: "0",
  source: "default",
});

const toBalanceTokenOption = (tokenBalance: {
  readonly token: EarnToken;
  readonly availableYields: ReadonlyArray<YieldId>;
  readonly amount: BigNumber;
}): EarnTokenOption => ({
  token: tokenBalance.token,
  availableYields: tokenBalance.availableYields,
  amount: tokenBalance.amount.toFixed(),
  source: "balance",
});

const toInitTokenOption = (tokenWithYields: {
  readonly token: EarnToken;
  readonly availableYields: ReadonlyArray<YieldId>;
}): EarnTokenOption => ({
  token: tokenWithYields.token,
  availableYields: tokenWithYields.availableYields,
  amount: "0",
  source: "init",
});

const toInitYieldTokenOption = (yieldDto: EarnYield): EarnTokenOption => ({
  token: yieldDto.token,
  availableYields: [yieldDto.id],
  amount: "0",
  source: "init",
});

const hasAvailableYields = (option: EarnTokenOption) =>
  option.availableYields.length > 0;

const getAvailableYieldIds = (
  items: ReadonlyArray<EarnTokenOption>
): ReadonlyArray<YieldId> =>
  [...new Set(items.flatMap((option) => option.availableYields))].sort();

const scopeTokenOptions = ({
  items,
  yieldIds,
}: {
  items: ReadonlyArray<EarnTokenOption>;
  yieldIds: ReadonlySet<YieldId> | null;
}) =>
  items
    .map((option) =>
      yieldIds
        ? {
            ...option,
            availableYields: option.availableYields.filter((yieldId) =>
              yieldIds.has(yieldId)
            ),
          }
        : option
    )
    .filter(hasAvailableYields);

const getPullItemsResult = (
  result: Atom.PullResult<EarnTokenOption, EarnCatalogError>
): AsyncResult.AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
> => {
  const itemsResult = result.pipe(
    AsyncResult.map((value) => value.items as ReadonlyArray<EarnTokenOption>)
  );
  const error = itemsResult.pipe(AsyncResult.error, Option.getOrNull);

  return Cause.isNoSuchElementError(error)
    ? AsyncResult.success([], { waiting: itemsResult.waiting })
    : (itemsResult as AsyncResult.AsyncResult<
        ReadonlyArray<EarnTokenOption>,
        EarnCatalogError
      >);
};

const findInitTokenOption = ({
  network,
  token,
  tokenOptions,
}: {
  network: Network | null;
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
  appRuntime.pull(() =>
    paginatedApiStream({
      fetchPage: (offset) =>
        Effect.gen(function* () {
          if (
            shouldUseYieldTokensApi({
              category: key.category,
              tokensForEnabledYieldsOnly: key.tokensForEnabledYieldsOnly,
            })
          ) {
            const api = yield* YieldApiService;
            const page = yield* api.getYieldTokens({
              limit: DEFAULT_PAGE_SIZE,
              offset,
              networks: toNetworksParam(key.network),
              yieldTypes: toYieldTypesParam(key.category),
            });
            const items = (page.items ?? []).map(toDefaultTokenOption);

            return {
              items,
              limit: page.limit,
              offset: page.offset,
              total: page.total,
            };
          }

          if (offset > 0) {
            return { items: [], limit: 1, offset, total: 0 };
          }

          const api = yield* LegacyApiService;
          const tokens = yield* api.getLegacyTokenOptions(
            key.network ?? undefined
          );

          return {
            items: tokens.map(toDefaultTokenOption),
            limit: Math.max(1, tokens.length),
            offset: 0,
            total: tokens.length,
          };
        }),
    }).pipe(mapCatalogStreamError("default-token-options"))
  )
);

const initTokenOptionAtom = Atom.family((key: InitTokenOptionKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.token) {
          return null;
        }

        const api = yield* LegacyApiService;
        const tokens = yield* api.getLegacyTokenOptions(
          key.network ?? undefined
        );

        return findInitTokenOption({
          network: key.network,
          token: key.token,
          tokenOptions: tokens.map(toInitTokenOption),
        });
      }).pipe(withCatalogError("init-token-option"))
    )
    .pipe(catalogSWR)
);

const tokenBalancesScanAtom = Atom.family((key: TokenBalancesScanKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.network) {
          return [];
        }

        const api = yield* LegacyApiService;
        const balances = yield* api.scanEarnTokenBalances({
          address: key.address,
          additionalAddresses: key.additionalAddresses ?? undefined,
          network: key.network as TokenBalanceScanCommand["network"],
        });

        return balances.map(toBalanceTokenOption);
      }).pipe(withCatalogError("token-balances-scan"))
    )
    .pipe(catalogSWR)
);

const tokenYieldScopeAtom = Atom.family((key: TokenYieldScopeKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.category || key.yieldIds.length === 0) {
          return new Set<YieldId>();
        }

        const api = yield* YieldApiService;
        const yields = yield* loadAllPagesByIdChunks({
          chunkSize: YIELD_IDS_CHUNK_SIZE,
          concurrency: PREFERRED_PAGE_CONCURRENCY,
          fetchPage: ({ ids, offset }) =>
            api.getTokenScopeYields({
              limit: DEFAULT_PAGE_SIZE,
              offset,
              types: toYieldTypesParam(key.category),
              yieldIds: ids,
            }),
          getItemId: (yieldDto) => yieldDto.id,
          ids: key.yieldIds,
          pageSize: DEFAULT_PAGE_SIZE,
        });

        return new Set(yields.map((yieldDto) => yieldDto.id));
      }).pipe(withCatalogError("token-yield-scope"))
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

  return Atom.readable<EarnTokenOptionsState>((context) => {
    const defaultResult = context.get(defaultTokenOptionsAtom);
    const balancesResult = context.get(tokenBalancesAtom);
    const initTokenResult = context.get(initTokenAtom);
    const initYieldResult = context.get(initYieldAtomValue);

    const tokenSourcesResult = AsyncResult.all({
      defaultItems: getPullItemsResult(defaultResult),
      balanceItems: balancesResult,
      initToken: initTokenResult,
      initYield: initYieldResult,
    });

    return AsyncResult.flatMap(tokenSourcesResult, (sources, sourcesResult) => {
      const rawInitItems = [
        sources.initYield ? toInitYieldTokenOption(sources.initYield) : null,
        sources.initToken,
      ].filter((option): option is EarnTokenOption => option !== null);
      const candidateYieldIds = getAvailableYieldIds([
        ...sources.balanceItems,
        ...rawInitItems,
      ]);
      const tokenYieldScopeResult: AsyncResult.AsyncResult<
        ReadonlySet<YieldId> | null,
        EarnCatalogError
      > =
        key.category && candidateYieldIds.length > 0
          ? context.get(
              tokenYieldScopeAtom(
                new TokenYieldScopeKey({
                  category: key.category,
                  yieldIds: candidateYieldIds,
                })
              )
            )
          : AsyncResult.success(key.category ? new Set<YieldId>() : null);
      const scopedResult = tokenYieldScopeResult.pipe(
        AsyncResult.map((scopedYieldIds) =>
          mergeTokenOptions({
            balanceItems: scopeTokenOptions({
              items: sources.balanceItems,
              yieldIds: scopedYieldIds,
            }),
            defaultItems: sources.defaultItems.filter(hasAvailableYields),
            initItems: scopeTokenOptions({
              items: rawInitItems,
              yieldIds: scopedYieldIds,
            }),
          })
        )
      );

      return sourcesResult.waiting
        ? AsyncResult.waiting(scopedResult)
        : scopedResult;
    });
  });
});

export const tokenOptionsPullAtom = defaultTokenOptionsPullAtom;

export const yieldValidatorsAtom = Atom.family(
  ({ selectedYieldId }: YieldValidatorsKey) => {
    const preferredValidatorsAtom = appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* YieldApiService;

          const validators = yield* loadAllPages({
            concurrency: PREFERRED_PAGE_CONCURRENCY,
            fetchPage: (offset: number) =>
              api.getValidators({
                limit: DEFAULT_PAGE_SIZE,
                offset,
                preferred: true,
                status: "active",
                yieldId: selectedYieldId,
              }),
            pageSize: DEFAULT_PAGE_SIZE,
          });

          return validators;
        }).pipe(withCatalogError("preferred-validators"))
      )
      .pipe(catalogSWR);

    const loadedValidatorsAtom = Atom.writable<
      Map<EarnValidatorKey, EarnValidator>,
      ReadonlyArray<EarnValidator>
    >(
      (context) => {
        const preferredValidators = context.get(preferredValidatorsAtom).pipe(
          AsyncResult.value,
          Option.getOrElse(() => [])
        );
        const loadedValidators = new Map(
          context
            .self<Map<EarnValidatorKey, EarnValidator>>()
            .pipe(
              Option.getOrElse(() => new Map<EarnValidatorKey, EarnValidator>())
            )
        );

        preferredValidators.forEach((validator) => {
          loadedValidators.set(validator.key, validator);
        });

        return loadedValidators;
      },
      (context, value) => {
        const newValue = new Map(context.get(loadedValidatorsAtom));

        value.forEach((validator) => {
          newValue.set(validator.key, validator);
        });

        context.setSelf(newValue);
      }
    );

    /**
     * If search is provided, we search all preferred and non-preferred validators
     * If search is not provided, we pull only non-preferred validators
     */
    const validatorsPullAtom = Atom.family(
      ({ search }: YieldValidatorsPullKey) =>
        appRuntime.pull(
          (context) => {
            return paginatedApiStream({
              fetchPage: (offset) =>
                Effect.gen(function* () {
                  const api = yield* YieldApiService;
                  const page = yield* api.getValidators({
                    limit: DEFAULT_PAGE_SIZE,
                    name: search || undefined,
                    address: search || undefined,
                    offset,
                    status: "active",
                    ...(search ? {} : { preferred: false }),
                    yieldId: selectedYieldId,
                  });
                  const items = page.items ?? [];

                  context.set(loadedValidatorsAtom, items);

                  return {
                    items,
                    limit: page.limit,
                    offset: page.offset,
                    total: page.total,
                  };
                }),
            }).pipe(mapCatalogStreamError("validators"));
          },
          { initialValue: [] }
        )
    );

    return {
      enabled: true,
      loadedValidatorsAtom,
      validatorsPullAtom,
    } satisfies EarnValidatorsResource;
  }
);
