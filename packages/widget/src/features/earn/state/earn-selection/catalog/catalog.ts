import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnValidator } from "../../../../../domain/earn/models";
import { filterValidators } from "../../../../../domain/earn/yield";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import { toPositionsData } from "../../../../../domain/portfolio/positions";
import { tokenString } from "../../../../../domain/token/token";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import {
  EarnTokenCatalogKey,
  earnTokenCatalogResourceAtom,
} from "../../../../../resources/earn-token-catalog/earn-token-catalog";
import { tokenBalancesResourceAtom } from "../../../../../resources/token-balances/token-balances";
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
import { mapAsyncResultError } from "../../../../../shared/effect/async-result";
import { validatorsConfigAtom } from "../../../../yield-entry/state";
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
  source: "default",
});

export const earnTokenCatalogAtom = Atom.family((key: EarnTokenCatalogKey) =>
  Atom.make((get) =>
    get(earnTokenCatalogResourceAtom.foreground(key)).pipe(
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
          ReadonlyArray<DashboardYieldCategory>,
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
  const source = enrichedYieldDirectoryResourceAtom.foreground(
    new YieldDirectoryKey({
      network: key.network,
      types: undefined,
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
  const source = key.scope
    ? yieldPositionsResourceAtom.foreground(key.scope)
    : null;

  return Atom.make((get) =>
    source
      ? get(source).pipe(
          AsyncResult.map((positions) => toPositionsData(positions.items)),
          mapAsyncResultError(toCatalogError("positions-data"))
        )
      : AsyncResult.success(new Map() as PositionsData)
  ).pipe(Atom.withLabel("earnPositionsDataAtom"));
});

const tokenBalancesResult = (
  get: Atom.AtomContext,
  key: TokenOptionsKey
): AsyncResult.AsyncResult<
  ReadonlyMap<string, string> | null,
  EarnCatalogError
> => {
  if (!key.scope) return AsyncResult.success(null);

  const result = get(tokenBalancesResourceAtom.foreground(key.scope)).pipe(
    AsyncResult.map(
      (balances) =>
        new Map(
          balances.map((balance) => [
            tokenString(balance.token),
            balance.amount.toFixed(),
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

const enrichTokenOptions = (
  canonical: ReadonlyArray<EarnTokenOption>,
  balances: ReadonlyMap<string, string> | null
) =>
  canonical
    .map((option, index) => {
      const amount = balances?.get(tokenString(option.token));
      return {
        index,
        option:
          amount === undefined
            ? option
            : ({ ...option, amount, source: "balance" } as EarnTokenOption),
      };
    })
    .sort((left, right) => {
      const leftHasBalance =
        left.option.amount !== null &&
        new BigNumber(left.option.amount).isGreaterThan(0);
      const rightHasBalance =
        right.option.amount !== null &&
        new BigNumber(right.option.amount).isGreaterThan(0);
      return (
        Number(rightHasBalance) - Number(leftHasBalance) ||
        left.index - right.index
      );
    })
    .map(({ option }) => option);

export const mergedTokenOptionsAtom = Atom.family((key: TokenOptionsKey) => {
  const catalogKey = new EarnTokenCatalogKey({
    category: key.category,
    network: key.scope?.network ?? null,
  });

  return Atom.make<EarnTokenOptionsState>((get) => {
    const catalog = get(earnTokenCatalogAtom(catalogKey));
    const balances = tokenBalancesResult(get, key);
    return AsyncResult.all({ balances, catalog }).pipe(
      AsyncResult.map(({ balances, catalog }) =>
        enrichTokenOptions(catalog, balances)
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
        Atom.mapResult(({ items }) => items.flatMap((page) => page.items)),
        Atom.map(mapAsyncResultError(toCatalogError("validators")))
      );
    const initialValidatorsResultAtom = Atom.make((get) => {
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
