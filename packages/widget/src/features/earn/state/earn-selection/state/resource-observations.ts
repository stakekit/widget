import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { isYieldValidatorSelectionRequired } from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { tokenString } from "../../../../../domain/token/token";
import { widgetConfigAtom } from "../../../../../features/widget-configuration/index";
import { EarnTokenCatalogKey } from "../../../../../resources/earn-token-catalog/index";
import {
  availableYieldCategoriesAtom,
  earnTokenCatalogAtom,
  earnYieldCatalogAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  yieldValidatorsAtom,
} from "../catalog/catalog";
import {
  AvailableYieldCategoriesKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../catalog/keys";
import { defaultTokenCandidates, isDefaultTokenChoice } from "../model/token";
import { matchesRequestedValidator } from "../model/validators";
import { resolveEarnView } from "../model/view";
import type {
  CategoryObservation,
  EarnResourceResult,
  EarnViewObservations,
  InitialViewObservations,
  ValidatorObservation,
} from "../model/view-inputs";
import { isReachableDefaultYield } from "../model/yield";
import type {
  EarnEntry,
  EarnEntryIntent,
  EarnSelectionView,
  EarnTokenOption,
} from "../types";

type EarnViewResolutionInput = Omit<
  Parameters<typeof resolveEarnView>[0],
  "observations"
>;

const readInitial = (
  context: Atom.AtomContext,
  entry: EarnEntry
): InitialViewObservations => ({
  network: entry.walletScope?.network ?? null,
  positions: context.get(
    positionsDataAtom(new PositionsDataKey({ scope: entry.walletScope }))
  ),
});

const readCategory = (
  context: Atom.AtomContext,
  {
    entry,
    network,
  }: {
    readonly entry: EarnEntry;
    readonly network: InitialViewObservations["network"];
  }
): CategoryObservation =>
  entry.categoryGrouping
    ? {
        _tag: "enabled",
        catalogs: entry.categoryOrder.map((category) => ({
          category,
          result: context.get(
            earnTokenCatalogAtom(new EarnTokenCatalogKey({ category, network }))
          ),
        })),
        result: context.get(
          availableYieldCategoriesAtom(
            new AvailableYieldCategoriesKey({
              categoryOrder: entry.categoryOrder,
              network,
            })
          )
        ),
      }
    : { _tag: "disabled" };

const readTokenOptions = (
  context: Atom.AtomContext,
  {
    category,
    entry,
  }: {
    readonly category: EarnSelectionView["selection"]["category"];
    readonly entry: EarnEntry;
  }
): EarnResourceResult<ReadonlyArray<EarnTokenOption>> =>
  context.get(
    mergedTokenOptionsAtom(
      new TokenOptionsKey({ category, scope: entry.walletScope })
    )
  );

const readYieldCatalog = (
  context: Atom.AtomContext,
  {
    selectedToken,
  }: {
    readonly selectedToken: EarnTokenOption;
  }
): EarnResourceResult<ReadonlyArray<EarnYieldWithProvider>> =>
  context.get(
    earnYieldCatalogAtom(
      new YieldCatalogKey({
        category: null,
        network: selectedToken.token.network,
        token: selectedToken.token.address || selectedToken.token.symbol,
        yieldIds: selectedToken.availableYields,
      })
    )
  );

const readValidators = (
  context: Atom.AtomContext,
  {
    intent,
    selectedYield,
  }: {
    readonly intent: EarnEntryIntent;
    readonly selectedYield: EarnYieldWithProvider;
  }
): {
  readonly key: YieldValidatorsKey | null;
  readonly observation: ValidatorObservation;
} => {
  if (!isYieldValidatorSelectionRequired(selectedYield)) {
    return { key: null, observation: { _tag: "disabled" } };
  }

  const key = new YieldValidatorsKey({
    network: selectedYield.token.network,
    selectedYieldId: selectedYield.id,
  });
  const resource = yieldValidatorsAtom(key);
  const initial = context.get(resource.initialValidatorsResultAtom);
  const initialValue = initial.pipe(AsyncResult.value, Option.getOrNull);
  const result = initial.pipe(AsyncResult.map(({ items }) => items));
  const options = initialValue?.items ?? [];
  const requestedValidator =
    intent.selectedValidators === null ? intent.requestedValidator : null;
  const requested =
    initialValue &&
    requestedValidator &&
    !options.some((validator) =>
      matchesRequestedValidator(validator, requestedValidator)
    )
      ? context
          .get(
            resource.validatorsPullAtom(
              new YieldValidatorsPullKey({ search: requestedValidator })
            )
          )
          .pipe(
            AsyncResult.map(
              ({ items }) =>
                items
                  .flatMap((page) => page.items)
                  .find((validator) =>
                    matchesRequestedValidator(validator, requestedValidator)
                  ) ?? null
            )
          )
      : null;
  return {
    key,
    observation: {
      _tag: "enabled",
      complete: initialValue?.complete ?? false,
      options,
      requested,
      result,
      validatorsConfig: context.get(widgetConfigAtom).validatorsConfig,
    },
  };
};

const bindValidatorsKey = (
  view: EarnSelectionView,
  key: YieldValidatorsKey | null
): EarnSelectionView => ({
  ...view,
  resources: {
    ...view.resources,
    validators: {
      ...view.resources.validators,
      key: view.resources.validators.enabled ? key : null,
    },
  },
});

/**
 * The yields of every default candidate on the selected token's network, when
 * the token picked for the user has no yield they can reach and another
 * candidate might. A yield catalog read is per network, so a candidate on
 * another network (only listed without a wallet) is not considered.
 */
const readReachableDefaultYields = (
  context: Atom.AtomContext,
  {
    entry,
    intent,
    positions,
    view,
    yieldCatalog,
  }: {
    readonly entry: EarnEntry;
    readonly intent: EarnEntryIntent;
    readonly positions: InitialViewObservations["positions"];
    readonly view: EarnSelectionView;
    readonly yieldCatalog: EarnResourceResult<
      ReadonlyArray<EarnYieldWithProvider>
    >;
  }
): EarnResourceResult<ReadonlyArray<EarnYieldWithProvider>> | null => {
  const token = view.selection.token;
  if (
    !token ||
    !isDefaultTokenChoice(entry, intent) ||
    Option.isNone(AsyncResult.value(yieldCatalog))
  ) {
    return null;
  }
  const selectedYield = view.selection.yield;
  if (
    selectedYield &&
    isReachableDefaultYield({
      availableAmount: token.amount,
      positions: view.resources.positions.data,
      yieldOption: selectedYield,
    })
  ) {
    return null;
  }
  const network = token.token.network;
  const candidates = defaultTokenCandidates(
    entry,
    view.resources.tokenOptions.items
  ).filter((option) => option.token.network === network);
  const selectedKey = tokenString(token.token);
  if (!candidates.some((option) => tokenString(option.token) !== selectedKey)) {
    return null;
  }
  // A holder's minimum can differ, so the move waits for the positions.
  if (
    Option.isNone(AsyncResult.value(positions)) &&
    !AsyncResult.isFailure(positions)
  ) {
    return AsyncResult.initial(true);
  }
  return context.get(
    earnYieldCatalogAtom(
      new YieldCatalogKey({
        category: null,
        network,
        token: null,
        yieldIds: candidates.flatMap((option) => option.availableYields),
      })
    )
  );
};

export const resolveEarnViewFromResources = (
  context: Atom.AtomContext,
  { entry, intent, previous = null }: EarnViewResolutionInput
): EarnSelectionView => {
  const initial = readInitial(context, entry);
  const category = readCategory(context, { entry, network: initial.network });
  const loading = <A>(): EarnResourceResult<A> => AsyncResult.initial();
  const makeObservations = (
    values: Partial<EarnViewObservations>
  ): EarnViewObservations => ({
    category,
    initial,
    reachableDefaultYields: null,
    tokenOptions: loading(),
    validators: { _tag: "disabled" },
    yieldCatalog: loading(),
    ...values,
  });
  const resolve = (values: Partial<EarnViewObservations>) =>
    resolveEarnView({
      entry,
      intent,
      observations: makeObservations(values),
      previous,
    });
  const categoryView = resolve({});

  if (
    categoryView.blockingFailure ||
    categoryView.loading.categories ||
    (entry.categoryGrouping && !categoryView.selection.category)
  ) {
    return bindValidatorsKey(categoryView, null);
  }

  const tokenOptions = readTokenOptions(context, {
    category: categoryView.selection.category,
    entry,
  });
  const tokenView = resolve({ tokenOptions });
  if (!tokenView.selection.token) return bindValidatorsKey(tokenView, null);

  const tokenYieldCatalog = readYieldCatalog(context, {
    selectedToken: tokenView.selection.token,
  });
  const catalogView = resolve({
    tokenOptions,
    yieldCatalog: tokenYieldCatalog,
  });

  const reachableDefaultYields = readReachableDefaultYields(context, {
    entry,
    intent,
    positions: initial.positions,
    view: catalogView,
    yieldCatalog: tokenYieldCatalog,
  });
  // A reachable default on another token moves the selection there, so its
  // catalog is read again for the token it lands on; none without a token.
  const resolveReachableDefault = (
    reachable: NonNullable<typeof reachableDefaultYields>
  ) => {
    const movedView = resolve({
      reachableDefaultYields: reachable,
      tokenOptions,
    });
    if (!movedView.selection.token) {
      return { view: movedView, yieldCatalog: null };
    }
    const yieldCatalog = readYieldCatalog(context, {
      selectedToken: movedView.selection.token,
    });
    return {
      view: resolve({
        reachableDefaultYields: reachable,
        tokenOptions,
        yieldCatalog,
      }),
      yieldCatalog,
    };
  };
  const { view, yieldCatalog } = reachableDefaultYields
    ? resolveReachableDefault(reachableDefaultYields)
    : { view: catalogView, yieldCatalog: tokenYieldCatalog };
  if (!yieldCatalog || !view.selection.yield) {
    return bindValidatorsKey(view, null);
  }

  const validators = readValidators(context, {
    intent,
    selectedYield: view.selection.yield,
  });
  return bindValidatorsKey(
    resolve({
      reachableDefaultYields,
      tokenOptions,
      validators: validators.observation,
      yieldCatalog,
    }),
    validators.key
  );
};
