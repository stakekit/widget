import BigNumber from "bignumber.js";
import { Cause, Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  EarnToken,
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { Network } from "../../../../../domain/schema/network-model";
import { isSupportedChain } from "../../../../../domain/types/chains";
import {
  type PositionsData,
  toPositionsData,
} from "../../../../../domain/types/positions";
import { tokenString } from "../../../../../domain/types/tokens";
import {
  filterValidators,
  getApiYieldTypesForDashboardCategory,
} from "../../../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import { legacyTokenOptionsResourceAtom } from "../../../../../resources/legacy-token-options/legacy-token-options";
import { tokenBalancesResourceAtom } from "../../../../../resources/token-balances/token-balances";
import {
  preferredValidatorsResourceAtom,
  ValidatorsKey,
  validatorsPullAtom as validatorsResourcePullAtom,
} from "../../../../../resources/validator-directory/validator-directory";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
  YieldFirstPageKey,
  yieldDirectoryResourceAtom,
  yieldFirstPageResourceAtom,
} from "../../../../../resources/yield-directory/yield-directory";
import {
  enrichedYieldOpportunityResourceAtom,
  yieldOpportunityResourceAtom,
} from "../../../../../resources/yield-opportunity/yield-opportunity";
import { yieldPositionsResourceAtom } from "../../../../../resources/yield-positions/yield-positions";
import {
  YieldTokensKey,
  yieldTokensPullAtom,
} from "../../../../../resources/yield-token-directory/yield-token-directory";
import { mapAsyncResultError } from "../../../../../shared/effect/async-result";
import type { PullPage } from "../../../../../shared/effect/pagination";
import { validatorsConfigAtom } from "../../../../yield-entry/state";
import {
  EarnCatalogError,
  type EarnCatalogOperation,
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

const toCatalogError = (operation: EarnCatalogOperation) => (cause: unknown) =>
  new EarnCatalogError({ operation, cause });

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
    Atom.readable(
      (get) => {
        const categoryResults = key.categoryOrder.map((category) =>
          get(
            yieldFirstPageResourceAtom.foreground(
              new YieldFirstPageKey({
                network: key.network,
                types: getApiYieldTypesForDashboardCategory(category),
              })
            )
          )
        );

        return AsyncResult.all(categoryResults).pipe(
          AsyncResult.map((pages) =>
            key.categoryOrder.filter((_, index) =>
              pages[index]?.some(
                (yieldModel) =>
                  yieldModel.status.enter &&
                  isSupportedChain(yieldModel.token.network)
              )
            )
          ),
          mapAsyncResultError(toCatalogError("available-yield-categories"))
        );
      },
      (refresh) =>
        key.categoryOrder.forEach((category) =>
          refresh(
            yieldFirstPageResourceAtom.foreground(
              new YieldFirstPageKey({
                network: key.network,
                types: getApiYieldTypesForDashboardCategory(category),
              })
            )
          )
        )
    ).pipe(Atom.withLabel("availableYieldCategoriesAtom"))
);

export const earnYieldCatalogAtom = Atom.family((key: YieldCatalogKey) => {
  const directoryKey = new YieldDirectoryKey({
    network: key.network,
    types: toYieldTypesParam(key.category),
    yieldIds: key.yieldIds,
  });
  const source = enrichedYieldDirectoryResourceAtom.foreground(directoryKey);
  const authoritativeSource =
    yieldDirectoryResourceAtom.foreground(directoryKey);

  return Atom.readable(
    (get) =>
      get(source).pipe(
        AsyncResult.map((directory) => directory.items),
        mapAsyncResultError(toCatalogError("earn-yield-catalog"))
      ),
    (refresh) => refresh(authoritativeSource)
  ).pipe(Atom.withLabel("earnYieldCatalogAtom"));
});

export const initYieldAtom = Atom.family((key: InitYieldKey) => {
  const source = key.yieldId
    ? enrichedYieldOpportunityResourceAtom.foreground(key.yieldId)
    : null;
  const authoritativeSource = key.yieldId
    ? yieldOpportunityResourceAtom.foreground(key.yieldId)
    : null;

  return Atom.readable(
    (get) =>
      source
        ? get(source).pipe(mapAsyncResultError(toCatalogError("init-yield")))
        : AsyncResult.success(null),
    (refresh) => {
      if (authoritativeSource) refresh(authoritativeSource);
    }
  ).pipe(Atom.withLabel("initYieldAtom"));
});

export const positionsDataAtom = Atom.family((key: PositionsDataKey) => {
  const source = key.scope
    ? yieldPositionsResourceAtom.foreground(key.scope)
    : null;

  return Atom.readable(
    (get) =>
      source
        ? get(source).pipe(
            AsyncResult.map((positions) => toPositionsData(positions.items)),
            mapAsyncResultError(toCatalogError("positions-data"))
          )
        : AsyncResult.success(new Map() as PositionsData),
    (refresh) => {
      if (source) refresh(source);
    }
  ).pipe(Atom.withLabel("earnPositionsDataAtom"));
});

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

const toInitYieldTokenOption = (
  yieldDto: EarnYieldWithProvider
): EarnTokenOption => ({
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
  result: Atom.PullResult<PullPage<EarnTokenOption>, EarnCatalogError>
): AsyncResult.AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
> => {
  const itemsResult = result.pipe(
    AsyncResult.map((value) =>
      EArray.flatMap(value.items, (page) => page.items)
    )
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

const legacyTokenOptionsAtom = Atom.family((network: Network | null) =>
  Atom.make((get) =>
    get(legacyTokenOptionsResourceAtom.foreground(network)).pipe(
      mapAsyncResultError(toCatalogError("legacy-token-options"))
    )
  ).pipe(Atom.withLabel("earnLegacyTokenOptionsAtom"))
);

const legacyTokenOptionsPullAtom = Atom.family((network: Network | null) => {
  const source = legacyTokenOptionsAtom(network);

  return Atom.writable<
    Atom.PullResult<PullPage<EarnTokenOption>, EarnCatalogError>,
    void
  >(
    (get) =>
      get(source).pipe(
        AsyncResult.map((items) => ({
          done: true,
          items: EArray.of({
            hasNextPage: false,
            items: EArray.map(items, toDefaultTokenOption),
          }),
        }))
      ),
    () => {},
    (refresh) => refresh(source)
  );
});

const defaultTokenOptionsPullAtom = Atom.family(
  (key: DefaultTokenOptionsKey) => {
    const useYieldTokens = shouldUseYieldTokensApi({
      category: key.category,
      tokensForEnabledYieldsOnly: key.tokensForEnabledYieldsOnly,
    });

    if (!useYieldTokens) return legacyTokenOptionsPullAtom(key.network);

    return yieldTokensPullAtom
      .foreground(
        new YieldTokensKey({
          networks: toNetworksParam(key.network),
          yieldTypes: toYieldTypesParam(key.category),
        })
      )
      .pipe(
        Atom.map((result) =>
          result.pipe(
            AsyncResult.map(({ done, items }) => ({
              done,
              items: EArray.map(items, (page) => ({
                ...page,
                items: EArray.map(page.items, toDefaultTokenOption),
              })),
            })),
            mapAsyncResultError(toCatalogError("default-token-options"))
          )
        )
      );
  }
);

const initTokenOptionAtom = Atom.family((key: InitTokenOptionKey) => {
  const source = legacyTokenOptionsAtom(key.network);

  return Atom.readable(
    (get) =>
      key.token
        ? get(source).pipe(
            AsyncResult.map((tokens) =>
              findInitTokenOption({
                network: key.network,
                token: key.token!,
                tokenOptions: tokens.map(toInitTokenOption),
              })
            ),
            mapAsyncResultError(toCatalogError("init-token-option"))
          )
        : AsyncResult.success(null),
    (refresh) => refresh(source)
  );
});

const tokenBalancesScanAtom = Atom.family((key: TokenBalancesScanKey) =>
  Atom.make((get) =>
    key.scope
      ? get(tokenBalancesResourceAtom.foreground(key.scope)).pipe(
          AsyncResult.map((balances) => balances.map(toBalanceTokenOption)),
          mapAsyncResultError(toCatalogError("token-balances-scan"))
        )
      : AsyncResult.success([])
  ).pipe(Atom.withLabel("earnTokenBalancesScanAtom"))
);

const tokenYieldScopeAtom = Atom.family((key: TokenYieldScopeKey) =>
  Atom.make((get) =>
    !key.category || key.yieldIds.length === 0
      ? AsyncResult.success(new Set<YieldId>())
      : get(
          yieldDirectoryResourceAtom.foreground(
            new YieldDirectoryKey({
              types: toYieldTypesParam(key.category),
              yieldIds: key.yieldIds,
            })
          )
        ).pipe(
          AsyncResult.map(
            ({ items: yields }) =>
              new Set(yields.map((yieldModel) => yieldModel.id))
          ),
          mapAsyncResultError(toCatalogError("token-yield-scope"))
        )
  ).pipe(Atom.withLabel("tokenYieldScopeAtom"))
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

const fallBackOnInitialFailure = <A>(
  result: AsyncResult.AsyncResult<A, EarnCatalogError>,
  fallback: A
): AsyncResult.AsyncResult<A, EarnCatalogError> =>
  AsyncResult.isFailure(result) && Option.isNone(AsyncResult.value(result))
    ? AsyncResult.success(fallback)
    : result;

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
  ) =>
    [
      ...new Set([...(prev?.availableYields ?? []), ...next.availableYields]),
    ].sort();

  const mergeOption = (
    prev:
      | {
          candidateIndex: number;
          option: EarnTokenOption;
        }
      | undefined,
    next: EarnTokenOption
  ): EarnTokenOption => ({
    ...next,
    availableYields: mergeAvailableYields(prev?.option, next),
  });

  const byKey = new Map<
    string,
    {
      candidateIndex: number;
      option: EarnTokenOption;
    }
  >();

  const mergeCandidate = (option: EarnTokenOption) => {
    const key = tokenString(option.token);
    const prev = byKey.get(key);

    byKey.set(key, {
      candidateIndex: prev?.candidateIndex ?? byKey.size,
      option: mergeOption(prev, option),
    });
  };

  defaultItems.forEach(mergeCandidate);
  initItems.forEach(mergeCandidate);

  balanceItems.forEach((option) => {
    const key = tokenString(option.token);
    const prev = byKey.get(key);
    if (!prev) return;

    byKey.set(key, {
      ...prev,
      option: {
        ...prev.option,
        amount: option.amount,
        source: "balance",
      },
    });
  });

  return [...byKey.values()]
    .sort((a, b) => {
      const rankDiff =
        getTokenOptionRank(a.option) - getTokenOptionRank(b.option);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return a.candidateIndex - b.candidateIndex;
    })
    .map(({ option }) => option);
};

export const mergedTokenOptionsAtom = Atom.family((key: TokenOptionsKey) => {
  const defaultTokenOptionsAtom = defaultTokenOptionsPullAtom(
    new DefaultTokenOptionsKey({
      category: key.category,
      network: key.scope?.network ?? null,
      tokensForEnabledYieldsOnly: key.tokensForEnabledYieldsOnly,
    })
  );
  const tokenBalancesAtom = tokenBalancesScanAtom(
    new TokenBalancesScanKey({
      scope: key.scope,
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
  const preferredTokensSource = legacyTokenOptionsAtom(
    key.preferredTokenNetwork
  );

  return Atom.readable<EarnTokenOptionsState>(
    (context) => {
      const defaultResult = context.get(defaultTokenOptionsAtom);
      const balancesResult = context.get(tokenBalancesAtom);
      const initTokenResult = context.get(initTokenAtom);
      const initYieldResult = context.get(initYieldAtomValue);
      const preferredTokenKeys = new Set(key.preferredTokenKeys);
      const balanceItemsResult = fallBackOnInitialFailure(
        balancesResult,
        [] as ReadonlyArray<EarnTokenOption>
      );
      const preferredTokensResult =
        preferredTokenKeys.size === 0
          ? AsyncResult.success<
              ReadonlyArray<EarnTokenOption>,
              EarnCatalogError
            >([])
          : context.get(preferredTokensSource).pipe(
              AsyncResult.map((tokens) =>
                tokens
                  .map(toDefaultTokenOption)
                  .filter((option) =>
                    preferredTokenKeys.has(tokenString(option.token))
                  )
              ),
              (result) =>
                AsyncResult.isFailure(result) &&
                Option.isNone(AsyncResult.value(result))
                  ? AsyncResult.success<
                      ReadonlyArray<EarnTokenOption>,
                      EarnCatalogError
                    >([])
                  : result
            );

      const tokenSourcesResult = AsyncResult.all({
        defaultItems: getPullItemsResult(defaultResult),
        balanceItems: balanceItemsResult,
        initToken: initTokenResult,
        initYield: initYieldResult,
        preferredItems: preferredTokensResult,
      });

      return AsyncResult.flatMap(
        tokenSourcesResult,
        (sources, sourcesResult) => {
          const defaultItems = sources.defaultItems.filter(hasAvailableYields);
          const defaultTokenKeys = new Set(
            defaultItems.map((option) => tokenString(option.token))
          );
          const initYieldItems = sources.initYield
            ? [toInitYieldTokenOption(sources.initYield)]
            : [];
          const supplementalInitTokenItems =
            sources.initToken &&
            !defaultTokenKeys.has(tokenString(sources.initToken.token))
              ? [sources.initToken]
              : [];
          const supplementalPreferredItems = sources.preferredItems.filter(
            (option) => !defaultTokenKeys.has(tokenString(option.token))
          );
          const candidateYieldIds = getAvailableYieldIds([
            ...supplementalInitTokenItems,
            ...supplementalPreferredItems,
          ]);
          const rawTokenYieldScopeResult: AsyncResult.AsyncResult<
            ReadonlySet<YieldId> | null,
            EarnCatalogError
          > =
            (key.category || key.tokensForEnabledYieldsOnly) &&
            candidateYieldIds.length > 0
              ? context.get(
                  tokenYieldScopeAtom(
                    new TokenYieldScopeKey({
                      category: key.category,
                      yieldIds: candidateYieldIds,
                    })
                  )
                )
              : AsyncResult.success(
                  key.category || key.tokensForEnabledYieldsOnly
                    ? new Set<YieldId>()
                    : null
                );
          const tokenYieldScopeResult =
            supplementalInitTokenItems.length > 0
              ? rawTokenYieldScopeResult.pipe(
                  mapAsyncResultError(
                    (error) =>
                      new EarnCatalogError({
                        cause: error.cause,
                        operation: "init-token-option",
                      })
                  )
                )
              : fallBackOnInitialFailure(
                  rawTokenYieldScopeResult,
                  key.category || key.tokensForEnabledYieldsOnly
                    ? new Set<YieldId>()
                    : null
                );
          const scopedResult = tokenYieldScopeResult.pipe(
            AsyncResult.map((scopedYieldIds) =>
              mergeTokenOptions({
                balanceItems: sources.balanceItems,
                defaultItems: [
                  ...defaultItems,
                  ...scopeTokenOptions({
                    items: supplementalPreferredItems,
                    yieldIds: scopedYieldIds,
                  }),
                ],
                initItems: [
                  ...initYieldItems,
                  ...scopeTokenOptions({
                    items: supplementalInitTokenItems,
                    yieldIds: scopedYieldIds,
                  }),
                ],
              })
            )
          );

          return sourcesResult.waiting
            ? AsyncResult.waiting(scopedResult)
            : scopedResult;
        }
      );
    },
    (refresh) => {
      refresh(defaultTokenOptionsAtom);
      refresh(tokenBalancesAtom);
      refresh(initTokenAtom);
      refresh(initYieldAtomValue);
      if (key.preferredTokenKeys.length > 0) refresh(preferredTokensSource);
    }
  );
});

export const tokenOptionsPullAtom = defaultTokenOptionsPullAtom;

const projectValidators = ({
  network,
  selectedYieldId,
  validators,
  validatorsConfig,
}: {
  readonly network: Network | null;
  readonly selectedYieldId: YieldId;
  readonly validators: ReadonlyArray<EarnValidator>;
  readonly validatorsConfig: Parameters<
    typeof filterValidators
  >[0]["validatorsConfig"];
}) => {
  const eligible = network
    ? filterValidators({
        network,
        validators,
        validatorsConfig,
        yieldId: selectedYieldId,
      })
    : [...validators];

  return eligible.sort(
    (first, second) => Number(!!second.preferred) - Number(!!first.preferred)
  );
};

export const yieldValidatorsAtom = Atom.family(
  ({ network, selectedYieldId }: YieldValidatorsKey) => {
    const preferredValidatorsSource =
      preferredValidatorsResourceAtom.foreground(selectedYieldId);
    const preferredValidatorsAtom = Atom.readable(
      (get) =>
        get(preferredValidatorsSource).pipe(
          mapAsyncResultError(toCatalogError("preferred-validators"))
        ),
      (refresh) => refresh(preferredValidatorsSource)
    );
    const defaultValidatorsPullAtom = validatorsResourcePullAtom.foreground(
      new ValidatorsKey({
        preferred: false,
        status: "active",
        yieldId: selectedYieldId,
      })
    );
    const defaultValidatorsResultAtom = Atom.readable(
      (get) =>
        get(defaultValidatorsPullAtom).pipe(
          AsyncResult.map(({ items }) => items.flatMap((page) => page.items)),
          mapAsyncResultError(toCatalogError("validators"))
        ),
      (refresh) => refresh(defaultValidatorsPullAtom)
    );
    const initialValidatorsResultAtom = Atom.readable(
      (get) => {
        const validatorsConfig = get(validatorsConfigAtom);

        return AsyncResult.all({
          defaults: get(defaultValidatorsResultAtom),
          preferred: get(preferredValidatorsAtom),
        }).pipe(
          AsyncResult.map(({ defaults, preferred }) =>
            projectValidators({
              network,
              selectedYieldId,
              validators: [
                ...new Map(
                  [...preferred, ...defaults].map((validator) => [
                    validator.key,
                    validator,
                  ])
                ).values(),
              ],
              validatorsConfig,
            })
          )
        );
      },
      (refresh) => {
        refresh(defaultValidatorsResultAtom);
        refresh(preferredValidatorsAtom);
      }
    );
    /**
     * If search is provided, we search all preferred and non-preferred validators
     * If search is not provided, we pull only non-preferred validators
     */
    const validatorsPullAtom = Atom.family(
      ({ search }: YieldValidatorsPullKey) => {
        const source = validatorsResourcePullAtom(
          new ValidatorsKey({
            preferred: search ? null : false,
            search,
            status: "active",
            yieldId: selectedYieldId,
          })
        );

        return Atom.transform(source, (get) =>
          get(source).pipe(
            AsyncResult.map(({ done, items }) => ({
              done,
              items: EArray.map(items, (page) => ({
                ...page,
                items: projectValidators({
                  network,
                  selectedYieldId,
                  validators: page.items,
                  validatorsConfig: get(validatorsConfigAtom),
                }),
              })),
            })),
            mapAsyncResultError(toCatalogError("validators"))
          )
        );
      }
    );

    return {
      enabled: true,
      initialValidatorsResultAtom,
      validatorsPullAtom,
    } satisfies EarnValidatorsResource;
  }
);
