import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { YieldCategory } from "../../../../../domain/earn/contract";
import type { EarnValidator } from "../../../../../domain/earn/models";
import { filterValidators } from "../../../../../domain/earn/yield";
import { exactZero } from "../../../../../domain/finance/exact";
import { isFundedBalance } from "../../../../../domain/finance/funded-balance";
import type { Prices } from "../../../../../domain/health/models";
import { toPositionsData } from "../../../../../domain/portfolio/positions";
import { tokenString } from "../../../../../domain/token/token";
import { widgetConfigAtom } from "../../../../../features/widget-configuration/index";
import {
  EarnTokenCatalogKey,
  earnTokenCatalogResourceAtom,
} from "../../../../../resources/earn-token-catalog/index";
import { tokenBalancesResourceAtom } from "../../../../../resources/token-balances/index";
import {
  PricesKey,
  pricesAtom,
} from "../../../../../resources/token-prices/index";
import {
  preferredValidatorsResourceAtom,
  ValidatorsKey,
  validatorsPullAtom as validatorsResourcePullAtom,
} from "../../../../../resources/validator-directory/index";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
} from "../../../../../resources/yield-directory/index";
import { yieldPositionsResourceAtom } from "../../../../../resources/yield-positions/index";
import { config } from "../../../../../shared/config/widget-defaults";
import { mapAsyncResultError } from "../../../../../shared/effect/async-result";
import { makeEmptyPositionsData } from "../model/view-model";
import {
  EarnCatalogError,
  type EarnCatalogOperation,
  type EarnTokenOption,
  type EarnTokenOptionsState,
  type EarnValidatorsResource,
} from "../types";
import type {
  AvailableYieldCategoriesKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "./keys";

const toCatalogError = (operation: EarnCatalogOperation) => (cause: unknown) =>
  new EarnCatalogError({ operation, cause });

const toTokenOption = (item: {
  readonly token: EarnTokenOption["token"];
  readonly availableYields: EarnTokenOption["availableYields"];
}): EarnTokenOption => ({
  ...item,
  amount: null,
  funded: false,
  source: "default",
});

export const earnTokenCatalogAtom = Atom.family((key: EarnTokenCatalogKey) =>
  Atom.make((get) =>
    // The Earn page shows this failure itself, with a retry, so it raises no
    // global error sheet.
    get(earnTokenCatalogResourceAtom.local(key)).pipe(
      AsyncResult.map((items) => items.map(toTokenOption)),
      mapAsyncResultError(toCatalogError("earn-token-catalog"))
    )
  ).pipe(Atom.withLabel("earnTokenCatalogAtom"))
);

export const availableYieldCategoriesAtom = Atom.family(
  (key: AvailableYieldCategoriesKey) =>
    Atom.make((get) => {
      const results = key.categoryOrder.map((category) =>
        get(
          earnTokenCatalogAtom(
            new EarnTokenCatalogKey({ category, network: key.network })
          )
        ).pipe(
          mapAsyncResultError(toCatalogError("available-yield-categories"))
        )
      );
      const available = key.categoryOrder.filter((_, index) =>
        results[index]?.pipe(
          AsyncResult.value,
          Option.exists((items) => items.length > 0)
        )
      );

      if (
        results.some(
          (result) =>
            Option.isNone(AsyncResult.value(result)) &&
            !AsyncResult.isFailure(result)
        )
      ) {
        return AsyncResult.initial<
          ReadonlyArray<YieldCategory>,
          EarnCatalogError
        >(true);
      }

      if (available.length > 0) {
        return AsyncResult.success(available, {
          waiting: results.some((result) => result.waiting),
        });
      }

      const failure = results.find(
        (result) =>
          AsyncResult.isFailure(result) &&
          Option.isNone(AsyncResult.value(result))
      );
      return failure
        ? failure.pipe(AsyncResult.map(() => available))
        : AsyncResult.success(available);
    }).pipe(Atom.withLabel("availableYieldCategoriesAtom"))
);

export const earnYieldCatalogAtom = Atom.family((key: YieldCatalogKey) => {
  // The Earn page shows this failure itself, with a retry, so it raises no
  // global error sheet.
  const source = enrichedYieldDirectoryResourceAtom.local(
    new YieldDirectoryKey({
      network: key.network,
      token: key.token,
      yieldIds: key.yieldIds,
    })
  );

  return Atom.make((get) =>
    get(source).pipe(
      AsyncResult.map((directory) => directory.items),
      mapAsyncResultError(toCatalogError("earn-yield-catalog"))
    )
  ).pipe(Atom.withLabel("earnYieldCatalogAtom"));
});

export const positionsDataAtom = Atom.family((key: PositionsDataKey) => {
  // The Earn page shows this failure itself, with a retry, so it raises no
  // global error sheet.
  const source = key.scope ? yieldPositionsResourceAtom.local(key.scope) : null;

  return Atom.make((get) =>
    source
      ? get(source).pipe(
          AsyncResult.map((positions) => toPositionsData(positions.items)),
          mapAsyncResultError(toCatalogError("positions-data"))
        )
      : AsyncResult.success(makeEmptyPositionsData())
  ).pipe(Atom.withLabel("earnPositionsDataAtom"));
});

const tokenBalancesResult = (
  get: Atom.AtomContext,
  key: TokenOptionsKey
): AsyncResult.AsyncResult<
  ReadonlyMap<string, BigNumber> | null,
  EarnCatalogError
> => {
  if (!key.scope) return AsyncResult.success(null);

  const result = get(tokenBalancesResourceAtom.foreground(key.scope)).pipe(
    AsyncResult.map(
      (balances) =>
        new Map(
          balances.map((balance) => [
            tokenString(balance.token),
            balance.amount,
          ])
        )
    ),
    mapAsyncResultError(toCatalogError("token-balances-scan"))
  );

  return AsyncResult.isFailure(result) &&
    Option.isNone(AsyncResult.value(result))
    ? AsyncResult.success(null)
    : result;
};

type RankedTokenOption = {
  readonly index: number;
  readonly option: EarnTokenOption;
  /** The balance's USD value; null while unpriced. */
  readonly valueUsd: BigNumber | null;
};

const rankTokenOption = (
  option: EarnTokenOption,
  index: number,
  prices: Prices | null
): RankedTokenOption => {
  const amount = option.amount;
  const price = amount?.isGreaterThan(0)
    ? (prices?.getByToken(option.token)?.price ?? null)
    : null;
  const priced = price?.isGreaterThan(0) ? price : null;
  return {
    index,
    // The one funded check Earn's selection ranks and defaults by.
    option: {
      ...option,
      funded: amount !== null && isFundedBalance({ amount, priceUsd: priced }),
    },
    valueUsd: amount && priced ? amount.times(priced) : null,
  };
};

/** Funded and priced first, by value; funded unpriced next; then the rest. */
const tokenRankGroup = (ranked: RankedTokenOption) => {
  if (!ranked.option.funded) return 2;
  return ranked.valueUsd ? 0 : 1;
};

/**
 * Balances the user holds the most of, by USD value, come first; without a
 * price a balance falls back to the unit threshold of the funded-balance rule.
 */
const enrichTokenOptions = (
  canonical: ReadonlyArray<EarnTokenOption>,
  balances: ReadonlyMap<string, BigNumber> | null,
  prices: Prices | null
) =>
  canonical
    .map((option, index) =>
      rankTokenOption(
        balances
          ? ({
              ...option,
              amount: balances.get(tokenString(option.token)) ?? exactZero(),
              source: "balance",
            } satisfies EarnTokenOption)
          : option,
        index,
        prices
      )
    )
    .sort((left, right) => {
      const group = tokenRankGroup(left) - tokenRankGroup(right);
      if (group !== 0) return group;
      const value =
        left.valueUsd && right.valueUsd
          ? (right.valueUsd.comparedTo(left.valueUsd) ?? 0)
          : 0;
      return value || left.index - right.index;
    })
    .map(({ option }) => option);

const positiveBalanceTokens = (
  canonical: ReadonlyArray<EarnTokenOption>,
  balances: ReadonlyMap<string, BigNumber> | null
) =>
  balances
    ? canonical
        .filter((option) =>
          balances.get(tokenString(option.token))?.isGreaterThan(0)
        )
        .map((option) => option.token)
    : [];

export const mergedTokenOptionsAtom = Atom.family((key: TokenOptionsKey) => {
  const catalogKey = new EarnTokenCatalogKey({
    category: key.category,
    network: key.scope?.network ?? null,
  });

  return Atom.make<EarnTokenOptionsState>((get) => {
    const merged = AsyncResult.all({
      balances: tokenBalancesResult(get, key),
      catalog: get(earnTokenCatalogAtom(catalogKey)),
    });
    const loaded = AsyncResult.value(merged).pipe(Option.getOrNull);
    const tokenList = loaded
      ? positiveBalanceTokens(loaded.catalog, loaded.balances)
      : [];
    // The same request the token sheet prices its balances with.
    const prices = get(
      pricesAtom.foreground(
        new PricesKey({
          request:
            tokenList.length > 0
              ? { currency: config.currency, tokenList }
              : null,
        })
      )
    );
    // The first ranking waits for prices; a later one ranks without them
    // rather than drop back to loading while new prices arrive.
    if (
      loaded &&
      AsyncResult.isInitial(prices) &&
      get
        .self<EarnTokenOptionsState>()
        .pipe(Option.flatMap(AsyncResult.value), Option.isNone)
    ) {
      return AsyncResult.initial(true);
    }
    const priced = prices.pipe(AsyncResult.value, Option.getOrNull);
    return merged.pipe(
      AsyncResult.map(({ balances, catalog }) =>
        enrichTokenOptions(catalog, balances, priced)
      )
    );
  }).pipe(Atom.withLabel("mergedEarnTokenOptionsAtom"));
});

const projectValidators = ({
  network,
  selectedYieldId,
  validators,
  validatorsConfig,
}: {
  readonly network: YieldValidatorsKey["network"];
  readonly selectedYieldId: YieldValidatorsKey["selectedYieldId"];
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
    const preferredValidatorsAtom = preferredValidatorsResourceAtom
      .foreground(selectedYieldId)
      .pipe(
        Atom.map(mapAsyncResultError(toCatalogError("preferred-validators")))
      );
    const defaultValidatorsResultAtom = validatorsResourcePullAtom
      .foreground(
        new ValidatorsKey({
          preferred: false,
          status: "active",
          yieldId: selectedYieldId,
        })
      )
      .pipe(
        Atom.mapResult(({ done, items }) => ({
          complete: done,
          items: items.flatMap((page) => page.items),
        })),
        Atom.map(mapAsyncResultError(toCatalogError("validators")))
      );
    const initialValidatorsResultAtom = Atom.make((get) => {
      const validatorsConfig = get(widgetConfigAtom).validatorsConfig;
      return AsyncResult.all({
        defaults: get(defaultValidatorsResultAtom),
        preferred: get(preferredValidatorsAtom),
      }).pipe(
        AsyncResult.map(({ defaults, preferred }) => ({
          complete: defaults.complete,
          items: projectValidators({
            network,
            selectedYieldId,
            validators: [
              ...new Map(
                [...preferred, ...defaults.items].map((validator) => [
                  validator.key,
                  validator,
                ])
              ).values(),
            ],
            validatorsConfig,
          }),
        }))
      );
    });
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
                  validatorsConfig: get(widgetConfigAtom).validatorsConfig,
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
