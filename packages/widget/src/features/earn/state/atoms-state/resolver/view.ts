import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYield } from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { PositionsData } from "../../../../../domain/types/positions";
import { tokenString } from "../../../../../domain/types/tokens";
import {
  getDashboardYieldCategory,
  isYieldValidatorSelectionRequired,
} from "../../../../../domain/types/yields";
import type {
  EarnCatalogError,
  EarnEntry,
  EarnMachineIntent,
  EarnMachineView,
} from "../types";
import { resolveCategory } from "./category";
import { canSubmitEarnForm, resolveForm } from "./form";
import { resolveToken } from "./token";
import { resolveValidators } from "./validators";
import {
  type ResourceObservation,
  readCategoryInput,
  readInitialViewInputs,
  readTokenOptionsInput,
  readValidatorInput,
  readYieldCatalogInput,
} from "./view-inputs";
import { makeEarnView } from "./view-model";
import { resolveYield, resolveYieldOptions } from "./yield";

const makeEmptyPositionsData = (): PositionsData => new Map();

const getAvailableValue = <A>(
  observation: ResourceObservation<A>,
  fallback: A
): A => (observation._tag === "available" ? observation.value : fallback);

const mapAvailableValue = <A, B>(
  observation: ResourceObservation<A>,
  map: (value: A) => B
): ResourceObservation<B> =>
  observation._tag === "available"
    ? { ...observation, value: map(observation.value) }
    : observation;

const isResolving = <A>(observation: ResourceObservation<A>) =>
  observation._tag === "loading" ||
  (observation._tag === "available" && observation.waiting);

const getInitYieldCategory = ({
  dashboardVariant,
  initYield,
  initYieldId,
}: {
  readonly dashboardVariant: boolean;
  readonly initYield: EarnYield | null;
  readonly initYieldId: EarnYield["id"] | null;
}) =>
  dashboardVariant && initYieldId && initYield
    ? getDashboardYieldCategory(initYield)
    : null;

const mergeYieldOptions = (yields: ReadonlyArray<EarnYield | null>) => {
  const byId = new Map<YieldId, EarnYield>();

  for (const yieldModel of yields) {
    if (yieldModel) byId.set(yieldModel.id, yieldModel);
  }

  return [...byId.values()];
};

const makeFailure = (
  stage: NonNullable<EarnMachineView["failure"]>["stage"],
  error: EarnCatalogError
): NonNullable<EarnMachineView["failure"]> => ({
  _tag: "ResourceFailure",
  error,
  stage,
});

export const resolveEarnView = ({
  context,
  entry,
  intent,
}: {
  context: Atom.AtomContext;
  entry: EarnEntry;
  intent: EarnMachineIntent;
}): EarnMachineView => {
  const initial = readInitialViewInputs({ context, entry, intent });
  const initYield = getAvailableValue(initial.initYield.observation, null);
  const positionsForSelection = getAvailableValue(
    initial.positions.observation,
    makeEmptyPositionsData()
  );
  const positionsResource = {
    data: positionsForSelection,
    waiting: initial.positions.waiting,
  };
  const initYieldCategory = getInitYieldCategory({
    dashboardVariant: entry.dashboardVariant,
    initYield,
    initYieldId: initial.initYieldId,
  });
  const categoryInput = readCategoryInput({
    context,
    entry,
    network: initial.network,
  });
  const availableCategories =
    categoryInput._tag === "enabled"
      ? getAvailableValue(categoryInput.observation, [])
      : [];

  if (
    categoryInput._tag === "enabled" &&
    categoryInput.observation._tag === "failed"
  ) {
    return makeEarnView({
      intent,
      status: "failed",
      failure: makeFailure("categories", categoryInput.observation.error),
      retryTargetAtom: categoryInput.retryTargetAtom,
      availableCategories,
      resources: { positions: positionsResource },
    });
  }

  if (
    categoryInput._tag === "enabled" &&
    categoryInput.observation._tag === "loading"
  ) {
    return makeEarnView({
      intent,
      status: "loading-categories",
      availableCategories,
      resources: { positions: positionsResource },
    });
  }

  if (categoryInput._tag === "enabled" && availableCategories.length === 0) {
    return makeEarnView({
      intent,
      status: "no-categories",
      availableCategories,
      resources: { positions: positionsResource },
    });
  }

  const category = resolveCategory({
    availableCategories,
    categoryOrder: entry.categoryOrder,
    selectedCategory: intent.selectedCategory ?? initYieldCategory,
    dashboardVariant: entry.dashboardVariant,
  });
  const tokenInput = readTokenOptionsInput({
    category,
    context,
    entry,
    selectionSeedYieldId: initial.selectionSeedYieldId,
  });
  const tokenOptions = getAvailableValue(tokenInput.observation, []);
  const tokenOptionsResource = {
    items: tokenOptions,
    waiting: tokenInput.waiting,
    pullAtom: tokenInput.pullAtom,
  };
  const stageResources = {
    positions: positionsResource,
    tokenOptions: tokenOptionsResource,
  };

  if (
    !intent.selectedTokenKey &&
    !intent.selectedYieldId &&
    (!!entry.initParams?.token || !!entry.initParams?.yieldId) &&
    isResolving(tokenInput.observation)
  ) {
    return makeEarnView({
      intent,
      status: "loading-initial-selection",
      availableCategories,
      selection: { category },
      resources: stageResources,
      can: { selectToken: tokenOptions.length > 0 },
    });
  }

  const explicitTokenPending =
    !!intent.selectedTokenKey &&
    !tokenOptions.some(
      (option) => tokenString(option.token) === intent.selectedTokenKey
    ) &&
    isResolving(tokenInput.observation);
  const selectedToken = explicitTokenPending
    ? null
    : resolveToken({
        entry,
        selectedTokenKey: intent.selectedTokenKey,
        tokenOptions,
      });

  if (!selectedToken) {
    const failed =
      tokenInput.observation._tag === "failed"
        ? tokenInput.observation.error
        : null;
    const failureStage =
      failed?.operation === "init-yield" ||
      failed?.operation === "init-token-option"
        ? "initial-selection"
        : "token-options";
    const tokenOptionsResolving =
      tokenInput.observation._tag === "loading" ||
      (tokenOptions.length === 0 &&
        tokenInput.observation._tag === "available" &&
        tokenInput.observation.waiting);
    const getStatus = (): EarnMachineView["status"] => {
      if (failed) return "failed";
      if (explicitTokenPending || tokenOptionsResolving) {
        return "loading-token-options";
      }
      return "no-tokens";
    };
    const status = getStatus();

    return makeEarnView({
      intent,
      status,
      failure: failed ? makeFailure(failureStage, failed) : null,
      retryTargetAtom: failed ? tokenInput.retryTargetAtom : null,
      availableCategories,
      selection: { category },
      resources: stageResources,
      can: { selectToken: tokenOptions.length > 0 },
    });
  }

  const yieldCatalogInput = readYieldCatalogInput({
    category,
    context,
    selectedToken,
  });
  const yieldObservation = mapAvailableValue(
    yieldCatalogInput.observation,
    (catalogYieldOptions) =>
      resolveYieldOptions({
        selectedToken,
        yieldsById: mergeYieldOptions([...catalogYieldOptions, initYield]),
      })
  );
  const yieldOptions = getAvailableValue(yieldObservation, []);
  const selectedYield = resolveYield({
    entry,
    positionsData: positionsForSelection,
    selectedToken,
    selectedYieldId: intent.selectedYieldId,
    yieldOptions,
  });
  const yieldResources = {
    ...stageResources,
    yields: {
      items: yieldOptions,
      waiting: yieldCatalogInput.waiting,
    },
  };

  if (!selectedYield) {
    const failed =
      yieldObservation._tag === "failed" ? yieldObservation.error : null;
    const getStatus = (): EarnMachineView["status"] => {
      if (failed) return "failed";
      if (isResolving(yieldObservation)) return "loading-yields";
      return "no-yields";
    };
    const status = getStatus();

    return makeEarnView({
      intent,
      status,
      failure: failed ? makeFailure("yields", failed) : null,
      retryTargetAtom: failed ? yieldCatalogInput.retryTargetAtom : null,
      availableCategories,
      selection: { category, token: selectedToken },
      resources: yieldResources,
      can: {
        selectToken: tokenOptions.length > 0,
        selectYield: yieldOptions.length > 0,
      },
    });
  }

  if (initial.positions.observation._tag !== "available") {
    const failed =
      initial.positions.observation._tag === "failed"
        ? initial.positions.observation.error
        : null;

    return makeEarnView({
      intent,
      status: failed ? "failed" : "loading-positions",
      failure: failed ? makeFailure("positions", failed) : null,
      retryTargetAtom: failed ? initial.positions.retryTargetAtom : null,
      availableCategories,
      selection: { category, token: selectedToken },
      resources: yieldResources,
      can: {
        selectToken: tokenOptions.length > 0,
        selectYield: yieldOptions.length > 0,
      },
    });
  }

  const validatorInput = readValidatorInput({
    context,
    selectedYield,
    validatorSelectionRequired:
      isYieldValidatorSelectionRequired(selectedYield),
  });
  const validatorOptions =
    validatorInput._tag === "enabled" ? validatorInput.options : [];
  const selectedValidators = resolveValidators({
    entry,
    selectedValidatorKeys: intent.selectedValidatorKeys,
    validatorOptions,
  });
  const availableAmount = entry.walletScope ? selectedToken.amount : null;
  const form = resolveForm({
    availableAmount,
    intent,
    positionsData: positionsForSelection,
    selectedYield,
  });
  const validatorResources = {
    ...yieldResources,
    validators: validatorInput.resource,
  };

  if (
    validatorInput._tag === "enabled" &&
    validatorInput.initial.observation._tag !== "available"
  ) {
    const failed =
      validatorInput.initial.observation._tag === "failed"
        ? validatorInput.initial.observation.error
        : null;

    return makeEarnView({
      intent,
      status: failed ? "failed" : "loading-validators",
      failure: failed ? makeFailure("validators", failed) : null,
      retryTargetAtom: failed ? validatorInput.initial.retryTargetAtom : null,
      availableCategories,
      selection: {
        category,
        token: selectedToken,
        yield: selectedYield,
      },
      form,
      resources: validatorResources,
      can: {
        selectToken: tokenOptions.length > 0,
        selectYield: yieldOptions.length > 0,
      },
    });
  }

  if (validatorInput._tag === "enabled" && validatorOptions.length === 0) {
    return makeEarnView({
      intent,
      status: "no-validators",
      availableCategories,
      selection: {
        category,
        token: selectedToken,
        yield: selectedYield,
      },
      form,
      resources: validatorResources,
      can: {
        selectToken: tokenOptions.length > 0,
        selectYield: yieldOptions.length > 0,
      },
    });
  }

  return makeEarnView({
    intent,
    status: "ready",
    availableCategories,
    selection: {
      category,
      token: selectedToken,
      validators: selectedValidators,
      yield: selectedYield,
    },
    form,
    resources: validatorResources,
    can: {
      selectToken: tokenOptions.length > 0,
      selectYield: yieldOptions.length > 0,
      selectValidator: validatorInput._tag === "enabled",
      submit:
        entry.walletScope !== null &&
        (validatorInput._tag === "disabled" || selectedValidators.length > 0) &&
        canSubmitEarnForm({
          availableAmount,
          form,
          positionsData: positionsForSelection,
          selectedYield,
        }),
    },
  });
};
