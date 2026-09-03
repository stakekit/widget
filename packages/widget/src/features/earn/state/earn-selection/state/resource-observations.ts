import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { isYieldValidatorSelectionRequired } from "../../../../../domain/earn/yield";
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
} from "../catalog/keys";
import { resolveEarnView } from "../model/view";
import type {
  CategoryObservation,
  EarnResourceResult,
  EarnViewObservations,
  InitialViewObservations,
  ValidatorObservation,
} from "../model/view-inputs";
import type { EarnEntry, EarnSelectionView, EarnTokenOption } from "../types";

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
  entry.dashboardVariant
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
        yieldIds: selectedToken.availableYields,
      })
    )
  );

const readValidators = (
  context: Atom.AtomContext,
  {
    selectedYield,
  }: {
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
  return {
    key,
    observation: {
      _tag: "enabled",
      complete: initialValue?.complete ?? false,
      options: initialValue?.items ?? [],
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

export const resolveEarnViewFromResources = (
  context: Atom.AtomContext,
  { entry, intent, previous }: EarnViewResolutionInput
): EarnSelectionView => {
  const initial = readInitial(context, entry);
  const category = readCategory(context, { entry, network: initial.network });
  const loading = <A>(): EarnResourceResult<A> => AsyncResult.initial();
  const makeObservations = (
    values: Partial<EarnViewObservations>
  ): EarnViewObservations => ({
    category,
    initial,
    tokenOptions: loading(),
    validators: { _tag: "disabled" },
    yieldCatalog: loading(),
    ...values,
  });
  let observations = makeObservations({});
  let view = resolveEarnView({ entry, intent, observations, previous });

  if (
    view.blockingFailure ||
    view.loading.categories ||
    (entry.dashboardVariant && !view.selection.category)
  ) {
    return bindValidatorsKey(view, null);
  }

  const tokenOptions = readTokenOptions(context, {
    category: view.selection.category,
    entry,
  });
  observations = makeObservations({ tokenOptions });
  view = resolveEarnView({ entry, intent, observations, previous });
  if (!view.selection.token) return bindValidatorsKey(view, null);

  const yieldCatalog = readYieldCatalog(context, {
    selectedToken: view.selection.token,
  });
  observations = makeObservations({ tokenOptions, yieldCatalog });
  view = resolveEarnView({ entry, intent, observations, previous });
  if (!view.selection.yield) return bindValidatorsKey(view, null);

  const validators = readValidators(context, {
    selectedYield: view.selection.yield,
  });
  observations = makeObservations({
    tokenOptions,
    validators: validators.observation,
    yieldCatalog,
  });
  return bindValidatorsKey(
    resolveEarnView({ entry, intent, observations, previous }),
    validators.key
  );
};
