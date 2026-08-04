import { Duration, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/config/settings";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { EarnValidatorKey } from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { TronResource } from "../../../domain/schema/legacy-models";
import { isYieldActionArgRequired } from "../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../public-api/types";
import {
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "./earn-selection/state/atoms";
import {
  earnTokenOptionsPageAtom,
  earnValidatorsPageAtom,
  loadMoreEarnTokenOptionsAtom,
  loadMoreEarnValidatorsPageAtom,
  retryEarnMachineAtom,
} from "./earn-selection/state/view-resources";
import type {
  EarnMachineView,
  EarnTokenKey as InternalEarnTokenKey,
  EarnTokenOption as InternalEarnTokenOption,
} from "./earn-selection/types";

type EarnTokenKey = InternalEarnTokenKey;
export type EarnTokenOption = InternalEarnTokenOption;
export type EarnSelection = EarnMachineView["selection"];

const validatorSearchAtom = Atom.make("").pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("earnSelectionValidatorSearchAtom")
);

const normalizedValidatorSearchAtom = Atom.make((get) =>
  get(validatorSearchAtom).trim()
).pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("normalizedEarnSelectionValidatorSearchAtom")
);

const debouncedValidatorSearchResultAtom = appRuntime
  .atom((get) =>
    get
      .stream(normalizedValidatorSearchAtom)
      .pipe(Stream.changes, Stream.debounce(Duration.millis(300)))
  )
  .pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel("debouncedEarnSelectionValidatorSearchResultAtom")
  );

const debouncedValidatorSearchAtom = Atom.make((get) =>
  get(debouncedValidatorSearchResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => "")
  )
).pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("debouncedEarnSelectionValidatorSearchAtom")
);

export const earnSelectionViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);

  return {
    canSubmit: machine.can.submit,
    form: machine.form,
    positions: machine.resources.positions.data,
    selection: machine.selection,
  } as const;
}).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnSelectionViewAtom"));

export const earnSelectionStatusViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);

  return {
    canRetry: machine.failure !== null,
    failureStage: machine.failure?.stage ?? null,
    isFetching:
      machine.resources.positions.waiting ||
      machine.resources.tokenOptions.waiting ||
      machine.resources.yields.waiting,
    status: machine.status,
  } as const;
}).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnSelectionStatusViewAtom"));

export const earnSelectionTokenOptionsViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);
  const page = get(earnTokenOptionsPageAtom);

  return {
    canSelect: machine.can.selectToken,
    items: machine.resources.tokenOptions.items,
    page,
    selected: machine.selection.token,
    waiting: machine.resources.tokenOptions.waiting,
  } as const;
}).pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("earnSelectionTokenOptionsViewAtom")
);

export const earnSelectionYieldOptionsViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);

  return {
    availableCategories: machine.availableCategories,
    canSelect: machine.can.selectYield,
    items: machine.resources.yields.items,
    selected: machine.selection.yield,
    selectedCategory: machine.selection.category,
    waiting: machine.resources.yields.waiting,
  } as const;
}).pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("earnSelectionYieldOptionsViewAtom")
);

export const earnSelectionValidatorOptionsViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);
  const search = get(validatorSearchAtom);
  const debouncedSearch = get(debouncedValidatorSearchAtom);
  const normalizedSearch = get(normalizedValidatorSearchAtom);
  const page = get(earnValidatorsPageAtom(debouncedSearch || null));

  return {
    canSelect: machine.can.selectValidator,
    enabled: machine.resources.validators.enabled,
    isDebouncing: normalizedSearch !== debouncedSearch,
    items: page.items,
    page: {
      hasMore: page.hasMore,
      isLoadingFirstPage: page.isLoadingFirstPage,
      isLoadingMore: page.isLoadingMore,
    },
    search,
    selected: machine.selection.validators,
    selectedYield: machine.selection.yield,
  } as const;
}).pipe(
  Atom.setIdleTTL(0),
  Atom.withLabel("earnSelectionValidatorOptionsViewAtom")
);

export const setEarnSelectionValidatorSearchAtom = Atom.fnSync(
  (search: string, context) => context.set(validatorSearchAtom, search)
).pipe(Atom.withLabel("setEarnSelectionValidatorSearchAtom"));

export const selectEarnSelectionTokenAtom = Atom.fnSync(
  (tokenKey: EarnTokenKey, context) =>
    context.set(earnMachineIntentAtom, {
      type: "token/select",
      tokenKey,
    })
).pipe(Atom.withLabel("selectEarnSelectionTokenAtom"));

export const selectEarnSelectionYieldAtom = Atom.fnSync(
  (yieldId: YieldId, context) =>
    context.set(earnMachineIntentAtom, { type: "yield/select", yieldId })
).pipe(Atom.withLabel("selectEarnSelectionYieldAtom"));

export const selectEarnSelectionCategoryAtom = Atom.fnSync(
  (category: DashboardYieldCategory, context) => {
    const config = context(widgetConfigAtom);
    if (
      !config.dashboardVariant ||
      config.yieldGrouping !== "category" ||
      context(earnMachineViewAtom).selection.category === category
    ) {
      return;
    }

    context.set(earnMachineIntentAtom, {
      type: "category/select",
      category,
    });
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
      earnMachineIntentAtom,
      isYieldActionArgRequired(selectedYield, "enter", "validatorAddresses")
        ? {
            type: "validator/multiselect",
            fallbackSelection: view.selected,
            validator,
          }
        : { type: "validator/select", validator }
    );
  }
).pipe(Atom.withLabel("selectEarnSelectionValidatorAtom"));

export const removeEarnSelectionValidatorAtom = Atom.fnSync(
  (validatorKey: EarnValidatorKey, context) => {
    const selected = context(earnSelectionValidatorOptionsViewAtom).selected;
    context.set(earnMachineIntentAtom, {
      type: "validator/remove",
      fallbackSelection: selected,
      validatorKey,
    });
  }
).pipe(Atom.withLabel("removeEarnSelectionValidatorAtom"));

export const selectEarnSelectionProviderAtom = Atom.fnSync(
  (providerYieldId: YieldId, context) =>
    context.set(earnMachineIntentAtom, {
      type: "providerYieldId/select",
      providerYieldId,
    })
).pipe(Atom.withLabel("selectEarnSelectionProviderAtom"));

export const setEarnSelectionAmountAtom = Atom.fnSync(
  (amount: string, context) =>
    context.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount,
    })
).pipe(Atom.withLabel("setEarnSelectionAmountAtom"));

export const setEarnSelectionMaxAmountAtom = Atom.fnSync(
  (amount: string, context) =>
    context.set(earnMachineIntentAtom, {
      type: "stakeAmount/max",
      amount,
    })
).pipe(Atom.withLabel("setEarnSelectionMaxAmountAtom"));

export const selectEarnSelectionTronResourceAtom = Atom.fnSync(
  (tronResource: TronResource, context) =>
    context.set(earnMachineIntentAtom, {
      type: "tronResource/select",
      tronResource,
    })
).pipe(Atom.withLabel("selectEarnSelectionTronResourceAtom"));

export const loadMoreEarnSelectionTokensAtom = loadMoreEarnTokenOptionsAtom;

export const loadMoreEarnSelectionValidatorsAtom = Atom.fnSync(
  (_input: undefined, context) => {
    context.set(
      loadMoreEarnValidatorsPageAtom,
      context(debouncedValidatorSearchAtom) || null
    );
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreEarnSelectionValidatorsAtom"));

export const retryEarnSelectionAtom = retryEarnMachineAtom;
