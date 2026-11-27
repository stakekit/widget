import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { EarnValidator } from "../../../../../domain/earn/validator";
import {
  getValidatorPolicyListing,
  rankedEligibleValidators,
  type ValidatorsConfig,
} from "../../../../../domain/earn/yield";
import { exactZero } from "../../../../../domain/finance/exact";
import { isFundedBalance } from "../../../../../domain/finance/funded-balance";
import type { Prices } from "../../../../../domain/finance/prices";
import { toPositionsData } from "../../../../../domain/portfolio/positions";
import { tokenString } from "../../../../../domain/token/token";
import {
  EarnTokenCatalogKey,
  earnTokenCatalogResourceAtom,
} from "../../../../../resources/earn-token-catalog/earn-token-catalog";
import { tokenBalancesResourceAtom } from "../../../../../resources/token-balances/token-balances";
import {
  PricesKey,
  optionalTokenPricesAtom,
} from "../../../../../resources/token-prices/token-prices";
import {
  preferredValidatorsResourceAtom,
  ValidatorsKey,
  validatorsPullAtom as validatorsResourcePullAtom,
} from "../../../../../resources/validator-directory/validator-directory";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
} from "../../../../../resources/yield-directory/yield-directory";
import { yieldPositionsResourceAtom } from "../../../../../resources/yield-positions/yield-positions";
import { widgetConfigAtom } from "../../../../../runtime/widget-config";
import { config } from "../../../../../shared/config/widget-defaults";
import { mapAsyncResultError } from "../../../../../shared/effect/async-result";
import type { PullPage } from "../../../../../shared/effect/pagination";
import {
  PolicyValidatorsKey,
  type PolicyValidators,
  policyBoundValidatorsAtom,
  policyValidatorsAtom,
  uniqueValidators,
} from "../../../../yield-entry/index";
import type {
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../../model/earn-selection/keys";
import {
  EarnCatalogError,
  type EarnCatalogOperation,
  type EarnTokenOption,
} from "../../../model/earn-selection/types";
import { makeEmptyPositionsData } from "../../../model/earn-selection/view-model";

type EarnTokenOptionsState = AsyncResult.AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
>;

type EarnValidatorsResource = {
  readonly enabled: boolean;
  readonly initialValidatorsResultAtom: Atom.Atom<
    AsyncResult.AsyncResult<
      Readonly<{
        readonly complete: boolean;
        readonly items: ReadonlyArray<EarnValidator>;
      }>,
      EarnCatalogError
    >
  >;
  readonly validatorsPullAtom: (
    key: YieldValidatorsPullKey
  ) => Atom.Writable<
    Atom.PullResult<PullPage<EarnValidator>, EarnCatalogError>,
    void
  >;
};

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
      optionalTokenPricesAtom.foreground(
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
  readonly validatorsConfig: ValidatorsConfig;
}) =>
  network
    ? rankedEligibleValidators({
        network,
        validators,
        validatorsConfig,
        yieldId: selectedYieldId,
      })
    : [...validators];

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
      const policyKey = network
        ? new PolicyValidatorsKey({ network, yieldId: selectedYieldId })
        : null;
      const listed = (): AsyncResult.AsyncResult<
        PolicyValidators,
        EarnCatalogError
      > => {
        const bounded = policyKey
          ? get(policyBoundValidatorsAtom(policyKey))
          : null;
        if (bounded) {
          return bounded.pipe(
            mapAsyncResultError(toCatalogError("validators"))
          );
        }
        const named: AsyncResult.AsyncResult<PolicyValidators> = policyKey
          ? get(policyValidatorsAtom(policyKey))
          : AsyncResult.success({ complete: true, validators: [] });
        return AsyncResult.all({
          defaults: get(defaultValidatorsResultAtom),
          named,
          preferred: get(preferredValidatorsAtom),
        }).pipe(
          AsyncResult.map(({ defaults, named, preferred }) => ({
            complete: defaults.complete,
            // Looked-up validators join after the directory's, keeping its order.
            validators: [...preferred, ...defaults.items, ...named.validators],
          }))
        );
      };

      return listed().pipe(
        AsyncResult.map(({ complete, validators }) => ({
          complete,
          items: projectValidators({
            network,
            selectedYieldId,
            validators: uniqueValidators(validators),
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

        return Atom.transform(source, (get) => {
          const validatorsConfig = get(widgetConfigAtom).validatorsConfig;
          // A bounded list is whole in the initial validators.
          if (
            !search &&
            network &&
            getValidatorPolicyListing({ network, validatorsConfig })
              .fromDirectory !== "all"
          ) {
            return AsyncResult.success({
              done: true,
              items: EArray.of({
                hasNextPage: false,
                items: EArray.empty<EarnValidator>(),
              }),
            });
          }
          return get(source).pipe(
            // Ranked as one list, so a validator the policy ranks first leads
            // even when it arrives on a later page.
            AsyncResult.map(({ done, items }) => ({
              done,
              items: EArray.of({
                hasNextPage: !done,
                items: projectValidators({
                  network,
                  selectedYieldId,
                  validators: items.flatMap((page) => page.items),
                  validatorsConfig,
                }),
              }),
            })),
            mapAsyncResultError(toCatalogError("validators"))
          );
        });
      }
    );

    return {
      enabled: true,
      initialValidatorsResultAtom,
      validatorsPullAtom,
    } satisfies EarnValidatorsResource;
  }
);
