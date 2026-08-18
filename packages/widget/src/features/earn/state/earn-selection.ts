import { Duration, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { TronResource } from "../../../domain/action/tron-resource";
import type { EarnValidatorKey } from "../../../domain/earn/models";
import { isYieldActionArgRequired } from "../../../domain/earn/yield";
import type { YieldId } from "../../../domain/identity/identifiers";
import { widgetConfigAtom } from "../../../features/widget-configuration/index";
import type { DashboardYieldCategory } from "../../../public-api/types";
import {
  removeValidator,
  selectCategory,
  selectProvider,
  selectToken,
  selectTronResource,
  selectValidator,
  selectYield,
  setAmount,
  setMaxAmount,
} from "./earn-selection/model/transitions";
import {
  earnEntryIntentAtom,
  earnSelectionViewAtom as internalEarnSelectionViewAtom,
} from "./earn-selection/state/atoms";
import {
  earnValidatorsPageAtom,
  loadMoreEarnValidatorsPageAtom,
} from "./earn-selection/state/view-resources";
import type { EarnTokenKey } from "./earn-selection/types";

export type { EarnSelection, EarnTokenOption } from "./earn-selection/types";

const validatorSearchAtom = Atom.make("").pipe(
  Atom.withLabel("earnSelectionValidatorSearchAtom")
);
const normalizedValidatorSearchAtom = Atom.make((get) =>
  get(validatorSearchAtom).trim()
).pipe(Atom.withLabel("normalizedEarnSelectionValidatorSearchAtom"));
const debouncedValidatorSearchResultAtom = appRuntime
  .atom((get) =>
    get
      .stream(normalizedValidatorSearchAtom)
      .pipe(Stream.changes, Stream.debounce(Duration.millis(300)))
  )
  .pipe(Atom.withLabel("debouncedEarnSelectionValidatorSearchResultAtom"));
const debouncedValidatorSearchAtom = Atom.make((get) =>
  get(debouncedValidatorSearchResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => "")
  )
).pipe(Atom.withLabel("debouncedEarnSelectionValidatorSearchAtom"));

export const earnSelectionViewAtom = Atom.make((get) => {
  const view = get(internalEarnSelectionViewAtom);
  return {
    canSubmit: view.can.submit,
    form: view.form,
    positions: view.resources.positions.data,
    selection: view.selection,
  } as const;
}).pipe(Atom.withLabel("earnSelectionViewAtom"));

export const earnSelectionStatusViewAtom = Atom.make((get) => {
  const view = get(internalEarnSelectionViewAtom);
  return {
    blockingFailure: view.blockingFailure,
    isFetching:
      view.loading.positions ||
      view.resources.tokenOptions.waiting ||
      view.resources.yields.waiting,
    loading: view.loading,
    empty: view.empty,
  } as const;
}).pipe(Atom.withLabel("earnSelectionStatusViewAtom"));

export const earnSelectionTokenOptionsViewAtom = Atom.make((get) => {
  const view = get(internalEarnSelectionViewAtom);
  return {
    canSelect: view.can.selectToken,
    items: view.resources.tokenOptions.items,
    selected: view.selection.token,
    waiting: view.resources.tokenOptions.waiting,
  } as const;
}).pipe(Atom.withLabel("earnSelectionTokenOptionsViewAtom"));

export const earnSelectionYieldOptionsViewAtom = Atom.make((get) => {
  const view = get(internalEarnSelectionViewAtom);
  return {
    availableCategories: view.availableCategories,
    canSelect: view.can.selectYield,
    items: view.resources.yields.items,
    selected: view.selection.yield,
    selectedCategory: view.selection.category,
    waiting: view.resources.yields.waiting,
  } as const;
}).pipe(Atom.withLabel("earnSelectionYieldOptionsViewAtom"));

export const earnSelectionValidatorOptionsViewAtom = Atom.make((get) => {
  const view = get(internalEarnSelectionViewAtom);
  const search = get(validatorSearchAtom);
  const debouncedSearch = get(debouncedValidatorSearchAtom);
  const normalizedSearch = get(normalizedValidatorSearchAtom);
  const page = get(earnValidatorsPageAtom(debouncedSearch || null));

  return {
    canSelect: view.can.selectValidator,
    enabled: view.resources.validators.enabled,
    isDebouncing: normalizedSearch !== debouncedSearch,
    items: page.items,
    page: {
      hasMore: page.hasMore,
      isLoadingFirstPage: page.isLoadingFirstPage,
      isLoadingMore: page.isLoadingMore,
    },
    search,
    selected: view.selection.validators,
    selectedYield: view.selection.yield,
  } as const;
}).pipe(Atom.withLabel("earnSelectionValidatorOptionsViewAtom"));

export const setEarnSelectionValidatorSearchAtom = Atom.fnSync(
  (search: string, context) => context.set(validatorSearchAtom, search)
).pipe(Atom.withLabel("setEarnSelectionValidatorSearchAtom"));

export const selectEarnSelectionTokenAtom = Atom.fnSync(
  (tokenKey: EarnTokenKey, context) =>
    context.set(
      earnEntryIntentAtom,
      selectToken(context(earnEntryIntentAtom), tokenKey)
    )
).pipe(Atom.withLabel("selectEarnSelectionTokenAtom"));

export const selectEarnSelectionYieldAtom = Atom.fnSync(
  (yieldId: YieldId, context) =>
    context.set(
      earnEntryIntentAtom,
      selectYield(context(earnEntryIntentAtom), yieldId)
    )
).pipe(Atom.withLabel("selectEarnSelectionYieldAtom"));

export const selectEarnSelectionCategoryAtom = Atom.fnSync(
  (category: DashboardYieldCategory, context) => {
    const config = context(widgetConfigAtom);
    if (
      !config.dashboardVariant ||
      config.yieldGrouping !== "category" ||
      context(internalEarnSelectionViewAtom).selection.category === category
    ) {
      return;
    }
    context.set(
      earnEntryIntentAtom,
      selectCategory(context(earnEntryIntentAtom), category)
    );
  }
).pipe(Atom.withLabel("selectEarnSelectionCategoryAtom"));

export const selectEarnSelectionValidatorAtom = Atom.fnSync(
  (validatorKey: EarnValidatorKey, context) => {
    const view = context(earnSelectionValidatorOptionsViewAtom);
    const selectedYield = view.selectedYield;
    const validator = view.items.find(
      (candidate) => candidate.key === validatorKey
    );
    if (!selectedYield || !validator) return;
    context.set(
      earnEntryIntentAtom,
      selectValidator({
        fallbackSelection: view.selected,
        intent: context(earnEntryIntentAtom),
        multiselect: isYieldActionArgRequired(
          selectedYield,
          "enter",
          "validatorAddresses"
        ),
        validator,
      })
    );
  }
).pipe(Atom.withLabel("selectEarnSelectionValidatorAtom"));

export const removeEarnSelectionValidatorAtom = Atom.fnSync(
  (validatorKey: EarnValidatorKey, context) => {
    const selected = context(earnSelectionValidatorOptionsViewAtom).selected;
    context.set(
      earnEntryIntentAtom,
      removeValidator({
        fallbackSelection: selected,
        intent: context(earnEntryIntentAtom),
        validatorKey,
      })
    );
  }
).pipe(Atom.withLabel("removeEarnSelectionValidatorAtom"));

export const selectEarnSelectionProviderAtom = Atom.fnSync(
  (providerYieldId: YieldId, context) =>
    context.set(
      earnEntryIntentAtom,
      selectProvider(context(earnEntryIntentAtom), providerYieldId)
    )
).pipe(Atom.withLabel("selectEarnSelectionProviderAtom"));

export const setEarnSelectionAmountAtom = Atom.fnSync(
  (amount: string, context) =>
    context.set(
      earnEntryIntentAtom,
      setAmount(context(earnEntryIntentAtom), amount)
    )
).pipe(Atom.withLabel("setEarnSelectionAmountAtom"));

export const setEarnSelectionMaxAmountAtom = Atom.fnSync(
  (amount: string, context) =>
    context.set(
      earnEntryIntentAtom,
      setMaxAmount(context(earnEntryIntentAtom), amount)
    )
).pipe(Atom.withLabel("setEarnSelectionMaxAmountAtom"));

export const selectEarnSelectionTronResourceAtom = Atom.fnSync(
  (tronResource: TronResource, context) =>
    context.set(
      earnEntryIntentAtom,
      selectTronResource(context(earnEntryIntentAtom), tronResource)
    )
).pipe(Atom.withLabel("selectEarnSelectionTronResourceAtom"));

export const loadMoreEarnSelectionValidatorsAtom = Atom.fnSync(
  (_input: undefined, context) => {
    context.set(
      loadMoreEarnValidatorsPageAtom,
      context(debouncedValidatorSearchAtom) || null
    );
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreEarnSelectionValidatorsAtom"));
