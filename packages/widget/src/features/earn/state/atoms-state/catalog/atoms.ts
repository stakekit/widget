import BigNumber from "bignumber.js";
import { Cause, Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  EarnToken,
  EarnValidator,
  EarnValidatorKey,
  EarnYield,
} from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { Network } from "../../../../../domain/schema/network-model";
import {
  type PositionsData,
  toPositionsData,
} from "../../../../../domain/types/positions";
import { tokenString } from "../../../../../domain/types/tokens";
import {
  getApiYieldTypesForDashboardCategory,
  isNonZeroRewardRateYield,
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
  YieldDirectoryKey,
  YieldFirstPageKey,
  yieldDirectoryResourceAtom,
  yieldFirstPageResourceAtom,
} from "../../../../../resources/yield-directory/yield-directory";
import { yieldOpportunityResourceAtom } from "../../../../../resources/yield-opportunity/yield-opportunity";
import { yieldPositionsResourceAtom } from "../../../../../resources/yield-positions/yield-positions";
import {
  YieldTokensKey,
  yieldTokensPullAtom,
} from "../../../../../resources/yield-token-directory/yield-token-directory";
import { mapAsyncResultError } from "../../../../../shared/effect/async-result";
import type { PullPage } from "../../../../../shared/effect/pagination";
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

const toCatalogError =
  (operation: EarnCatalogOperation) => (cause: EarnCatalogUnderlyingError) =>
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
    Atom.make((get) => {
      const categoryResults = key.categoryOrder.map((category) =>
        get(
          yieldFirstPageResourceAtom(
            new YieldFirstPageKey({
              network: key.network,
              types: getApiYieldTypesForDashboardCategory(category),
            })
          )
        )
      );

      return mapAsyncResultError(
        AsyncResult.all(categoryResults).pipe(
          AsyncResult.map((pages) =>
            key.categoryOrder.filter((_, index) =>
              pages[index]?.some(
                (yieldModel) =>
                  yieldModel.status.enter &&
                  isNonZeroRewardRateYield(yieldModel)
              )
            )
          )
        ),
        toCatalogError("available-yield-categories")
      );
    }).pipe(Atom.withLabel("availableYieldCategoriesAtom"))
);

export const earnYieldCatalogAtom = Atom.family((key: YieldCatalogKey) => {
  return Atom.make((get) =>
    mapAsyncResultError(
      get(
        yieldDirectoryResourceAtom(
          new YieldDirectoryKey({
            network: key.network,
            types: toYieldTypesParam(key.category),
            yieldIds: key.yieldIds,
          })
        )
      ).pipe(AsyncResult.map((directory) => directory.items)),
      toCatalogError("earn-yield-catalog")
    )
  ).pipe(Atom.withLabel("earnYieldCatalogAtom"));
});

export const initYieldAtom = Atom.family((key: InitYieldKey) =>
  Atom.make((get) =>
    key.yieldId
      ? mapAsyncResultError(
          get(yieldOpportunityResourceAtom(key.yieldId)),
          toCatalogError("init-yield")
        )
      : AsyncResult.success(null)
  ).pipe(Atom.withLabel("initYieldAtom"))
);

export const positionsDataAtom = Atom.family((key: PositionsDataKey) =>
  Atom.make((get) =>
    key.scope
      ? mapAsyncResultError(
          get(yieldPositionsResourceAtom(key.scope)).pipe(
            AsyncResult.map((positions) => toPositionsData(positions.items))
          ),
          toCatalogError("positions-data")
        )
      : AsyncResult.success(new Map() as PositionsData)
  ).pipe(Atom.withLabel("earnPositionsDataAtom"))
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
    mapAsyncResultError(
      get(legacyTokenOptionsResourceAtom(network)),
      toCatalogError("legacy-token-options")
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

    return yieldTokensPullAtom(
      new YieldTokensKey({
        networks: toNetworksParam(key.network),
        yieldTypes: toYieldTypesParam(key.category),
      })
    ).pipe(
      Atom.map((result) =>
        mapAsyncResultError(
          result.pipe(
            AsyncResult.map(({ done, items }) => ({
              done,
              items: EArray.map(items, (page) => ({
                ...page,
                items: EArray.map(page.items, toDefaultTokenOption),
              })),
            }))
          ),
          toCatalogError("default-token-options")
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
        ? AsyncResult.map(get(source), (tokens) =>
            findInitTokenOption({
              network: key.network,
              token: key.token!,
              tokenOptions: tokens.map(toInitTokenOption),
            })
          )
        : AsyncResult.success(null),
    (refresh) => refresh(source)
  );
});

const tokenBalancesScanAtom = Atom.family((key: TokenBalancesScanKey) =>
  Atom.make((get) =>
    key.scope
      ? mapAsyncResultError(
          get(tokenBalancesResourceAtom(key.scope)).pipe(
            AsyncResult.map((balances) => balances.map(toBalanceTokenOption))
          ),
          toCatalogError("token-balances-scan")
        )
      : AsyncResult.success([])
  ).pipe(Atom.withLabel("earnTokenBalancesScanAtom"))
);

const tokenYieldScopeAtom = Atom.family((key: TokenYieldScopeKey) =>
  Atom.make((get) =>
    !key.category || key.yieldIds.length === 0
      ? AsyncResult.success(new Set<YieldId>())
      : mapAsyncResultError(
          get(
            yieldDirectoryResourceAtom(
              new YieldDirectoryKey({
                types: toYieldTypesParam(key.category),
                yieldIds: key.yieldIds,
              })
            )
          ).pipe(
            AsyncResult.map(
              ({ items: yields }) =>
                new Set(yields.map((yieldModel) => yieldModel.id))
            )
          ),
          toCatalogError("token-yield-scope")
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
    const preferredValidatorsAtom = Atom.make((get) =>
      mapAsyncResultError(
        get(preferredValidatorsResourceAtom(selectedYieldId)),
        toCatalogError("preferred-validators")
      )
    );
    const defaultValidatorsPullAtom = validatorsResourcePullAtom(
      new ValidatorsKey({
        preferred: false,
        status: "active",
        yieldId: selectedYieldId,
      })
    );
    const rememberedValidatorsAtom = Atom.make(
      new Map<EarnValidatorKey, EarnValidator>()
    );

    const loadedValidatorsAtom = Atom.writable<
      Map<EarnValidatorKey, EarnValidator>,
      ReadonlyArray<EarnValidator>
    >(
      (context) => {
        const preferredValidators = context.get(preferredValidatorsAtom).pipe(
          AsyncResult.value,
          Option.getOrElse(() => [])
        );
        const defaultValidators = context.get(defaultValidatorsPullAtom).pipe(
          AsyncResult.value,
          Option.map(({ items }) => items.flatMap((page) => page.items)),
          Option.getOrElse(() => [])
        );
        const loadedValidators = new Map<EarnValidatorKey, EarnValidator>(
          [...preferredValidators, ...defaultValidators].map((validator) => [
            validator.key,
            validator,
          ])
        );

        context.get(rememberedValidatorsAtom).forEach((validator) => {
          loadedValidators.set(validator.key, validator);
        });

        return loadedValidators;
      },
      (context, value) => {
        const newValue = new Map(context.get(rememberedValidatorsAtom));

        value.forEach((validator) => {
          newValue.set(validator.key, validator);
        });

        context.set(rememberedValidatorsAtom, newValue);
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

        return source.pipe(
          Atom.map((result) =>
            mapAsyncResultError(result, toCatalogError("validators"))
          )
        );
      }
    );

    return {
      enabled: true,
      loadedValidatorsAtom,
      validatorsPullAtom,
    } satisfies EarnValidatorsResource;
  }
);
