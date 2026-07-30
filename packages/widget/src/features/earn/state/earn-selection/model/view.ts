import { Match } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
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
import {
  type EarnViewStage,
  makeEarnView,
  makeEmptyPositionsData,
} from "./view-model";
import { resolveYield, resolveYieldOptions } from "./yield";

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

const getObservationError = <A>(observation: ResourceObservation<A>) =>
  observation._tag === "failed" ? observation.error : null;

const getInitYieldCategory = ({
  dashboardVariant,
  initYield,
  initYieldId,
}: {
  readonly dashboardVariant: boolean;
  readonly initYield: EarnYieldWithProvider | null;
  readonly initYieldId: EarnYieldWithProvider["id"] | null;
}) =>
  dashboardVariant && initYieldId && initYield
    ? getDashboardYieldCategory(initYield)
    : null;

const mergeYieldOptions = (
  yields: ReadonlyArray<EarnYieldWithProvider | null>
) => {
  const byId = new Map<YieldId, EarnYieldWithProvider>();

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
  previous = null,
}: {
  context: Atom.AtomContext;
  entry: EarnEntry;
  intent: EarnMachineIntent;
  previous?: EarnMachineView | null;
}): EarnMachineView => {
  const initial = readInitialViewInputs({ context, entry, intent });
  const initYield = getAvailableValue(initial.initYield.observation, null);
  const positionsForSelection = getAvailableValue(
    initial.positions.observation,
    makeEmptyPositionsData()
  );
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
  const categoryStage: EarnViewStage = {
    availableCategories,
    resources: {
      positions: {
        data: positionsForSelection,
        waiting: initial.positions.waiting,
      },
    },
  };

  if (categoryInput._tag === "enabled") {
    const failed = getObservationError(categoryInput.observation);

    if (failed) {
      return makeEarnView({
        ...categoryStage,
        intent,
        status: "failed",
        failure: makeFailure("categories", failed),
        retryTarget: categoryInput.retryTarget,
      });
    }

    if (categoryInput.observation._tag === "loading") {
      return makeEarnView({
        ...categoryStage,
        intent,
        status: "loading-categories",
      });
    }

    if (availableCategories.length === 0) {
      return makeEarnView({
        ...categoryStage,
        intent,
        status: "no-categories",
      });
    }
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
  const tokenStage: EarnViewStage = {
    ...categoryStage,
    resources: {
      ...categoryStage.resources,
      tokenOptions: {
        items: tokenOptions,
        waiting: tokenInput.waiting,
        pullKey: tokenInput.pullKey,
      },
    },
    selection: { category },
  };

  if (
    !intent.selectedTokenKey &&
    !intent.selectedYieldId &&
    (!!entry.initParams?.token || !!entry.initParams?.yieldId) &&
    isResolving(tokenInput.observation)
  ) {
    return makeEarnView({
      ...tokenStage,
      intent,
      status: "loading-initial-selection",
    });
  }

  const explicitTokenPending =
    !!intent.selectedTokenKey &&
    !tokenOptions.some(
      (option) => tokenString(option.token) === intent.selectedTokenKey
    ) &&
    isResolving(tokenInput.observation);
  const previousToken =
    previous?.selection.category === category ? previous.selection.token : null;
  const selectedToken = explicitTokenPending
    ? null
    : resolveToken({
        entry,
        previousToken,
        selectedTokenKey: intent.selectedTokenKey,
        tokenOptions,
      });

  if (!selectedToken) {
    const failed = getObservationError(tokenInput.observation);
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
    const status = Match.value({
      failed: failed !== null,
      loading: explicitTokenPending || tokenOptionsResolving,
    }).pipe(
      Match.when({ failed: true }, (): EarnMachineView["status"] => "failed"),
      Match.when(
        { loading: true },
        (): EarnMachineView["status"] => "loading-token-options"
      ),
      Match.orElse((): EarnMachineView["status"] => "no-tokens")
    );

    return makeEarnView({
      ...tokenStage,
      intent,
      status,
      failure: failed ? makeFailure(failureStage, failed) : null,
      retryTarget: failed ? tokenInput.retryTarget : null,
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
  const yieldStage: EarnViewStage = {
    ...tokenStage,
    resources: {
      ...tokenStage.resources,
      yields: {
        items: yieldOptions,
        waiting: yieldCatalogInput.waiting,
      },
    },
    selection: { category, token: selectedToken },
  };

  if (!selectedYield) {
    const failed = getObservationError(yieldObservation);
    const status = Match.value({
      failed: failed !== null,
      loading: isResolving(yieldObservation),
    }).pipe(
      Match.when({ failed: true }, (): EarnMachineView["status"] => "failed"),
      Match.when(
        { loading: true },
        (): EarnMachineView["status"] => "loading-yields"
      ),
      Match.orElse((): EarnMachineView["status"] => "no-yields")
    );

    return makeEarnView({
      ...yieldStage,
      intent,
      status,
      failure: failed ? makeFailure("yields", failed) : null,
      retryTarget: failed ? yieldCatalogInput.retryTarget : null,
    });
  }

  if (initial.positions.observation._tag !== "available") {
    const failed = getObservationError(initial.positions.observation);

    return makeEarnView({
      ...yieldStage,
      intent,
      status: failed ? "failed" : "loading-positions",
      failure: failed ? makeFailure("positions", failed) : null,
      retryTarget: failed ? initial.positions.retryTarget : null,
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
  const availableAmount = entry.walletScope ? selectedToken.amount : null;
  const form = resolveForm({
    availableAmount,
    intent,
    positionsData: positionsForSelection,
    selectedYield,
  });
  const validatorStage: EarnViewStage = {
    ...yieldStage,
    form,
    resources: {
      ...yieldStage.resources,
      validators: validatorInput.resource,
    },
    selection: { category, token: selectedToken, yield: selectedYield },
  };

  if (validatorInput._tag === "enabled") {
    if (validatorInput.initial.observation._tag !== "available") {
      const failed = getObservationError(validatorInput.initial.observation);

      return makeEarnView({
        ...validatorStage,
        intent,
        status: failed ? "failed" : "loading-validators",
        failure: failed ? makeFailure("validators", failed) : null,
        retryTarget: failed ? validatorInput.initial.retryTarget : null,
      });
    }

    if (validatorOptions.length === 0) {
      return makeEarnView({
        ...validatorStage,
        intent,
        status: "no-validators",
      });
    }
  }

  const selectedValidators = resolveValidators({
    entry,
    selectedValidatorKeys: intent.selectedValidatorKeys,
    validatorOptions,
  });

  return makeEarnView({
    ...validatorStage,
    intent,
    status: "ready",
    selection: {
      category,
      token: selectedToken,
      validators: selectedValidators,
      yield: selectedYield,
    },
    can: {
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
