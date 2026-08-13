import { Match, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { getDashboardYieldCategory } from "../../../../../domain/earn/yield";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import { tokenString } from "../../../../../domain/token/token";
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
  disabledValidatorsViewResource,
  type EarnResourceResult,
  type EarnViewObservations,
} from "./view-inputs";
import {
  type EarnViewStage,
  makeEarnView,
  makeEmptyPositionsData,
} from "./view-model";
import { resolveYield, resolveYieldOptions } from "./yield";

const getAvailableValue = <A>(result: EarnResourceResult<A>, fallback: A): A =>
  AsyncResult.getOrElse(result, () => fallback);

const mapAvailableValue = <A, B>(
  result: EarnResourceResult<A>,
  map: (value: A) => B
): EarnResourceResult<B> => result.pipe(AsyncResult.map(map));

const hasAvailableValue = <A>(result: EarnResourceResult<A>) =>
  Option.isSome(AsyncResult.value(result));

const isResolving = <A>(result: EarnResourceResult<A>) =>
  result.waiting ||
  (!hasAvailableValue(result) && Option.isNone(AsyncResult.error(result)));

const getBlockingError = <A>(result: EarnResourceResult<A>) =>
  hasAvailableValue(result)
    ? null
    : result.pipe(AsyncResult.error, Option.getOrNull);

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
  entry,
  intent,
  observations,
  previous = null,
}: {
  entry: EarnEntry;
  intent: EarnMachineIntent;
  observations: EarnViewObservations;
  previous?: EarnMachineView | null;
}): EarnMachineView => {
  const initial = observations.initial;
  const initYield = getAvailableValue(initial.initYield, null);
  const positionsForSelection = getAvailableValue(
    initial.positions,
    makeEmptyPositionsData()
  );
  const initYieldCategory = getInitYieldCategory({
    dashboardVariant: entry.dashboardVariant,
    initYield,
    initYieldId: initial.initYieldId,
  });
  const categoryInput = observations.category;
  const availableCategories =
    categoryInput._tag === "enabled"
      ? getAvailableValue(categoryInput.result, [])
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
    const failed = getBlockingError(categoryInput.result);

    if (failed) {
      return makeEarnView({
        ...categoryStage,
        intent,
        status: "failed",
        failure: makeFailure("categories", failed),
      });
    }

    if (!hasAvailableValue(categoryInput.result)) {
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
  const tokenInput = observations.tokenOptions;
  const tokenOptions = getAvailableValue(tokenInput, []);
  const tokenStage: EarnViewStage = {
    ...categoryStage,
    resources: {
      ...categoryStage.resources,
      tokenOptions: {
        items: tokenOptions,
        waiting: tokenInput.waiting,
        pullKey: null,
      },
    },
    selection: { category },
  };

  if (
    !intent.selectedTokenKey &&
    !intent.selectedYieldId &&
    (!!entry.initParams?.token || !!entry.initParams?.yieldId) &&
    isResolving(tokenInput)
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
    isResolving(tokenInput);
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
    const failed = getBlockingError(tokenInput);
    const failureStage =
      failed?.operation === "init-yield" ||
      failed?.operation === "init-token-option"
        ? "initial-selection"
        : "token-options";
    const tokenOptionsResolving =
      AsyncResult.isInitial(tokenInput) ||
      (tokenOptions.length === 0 &&
        hasAvailableValue(tokenInput) &&
        tokenInput.waiting);
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
    });
  }

  const yieldCatalogInput = observations.yieldCatalog;
  const yieldObservation = mapAvailableValue(
    yieldCatalogInput,
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
    const failed = getBlockingError(yieldObservation);
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
    });
  }

  if (!hasAvailableValue(initial.positions)) {
    const failed = getBlockingError(initial.positions);

    return makeEarnView({
      ...yieldStage,
      intent,
      status: failed ? "failed" : "loading-positions",
      failure: failed ? makeFailure("positions", failed) : null,
    });
  }

  const validatorInput = observations.validators;
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
      validators:
        validatorInput._tag === "enabled"
          ? { enabled: true, items: validatorOptions, key: null }
          : disabledValidatorsViewResource,
    },
    selection: { category, token: selectedToken, yield: selectedYield },
  };

  if (validatorInput._tag === "enabled") {
    if (!hasAvailableValue(validatorInput.result)) {
      const failed = getBlockingError(validatorInput.result);

      return makeEarnView({
        ...validatorStage,
        intent,
        status: failed ? "failed" : "loading-validators",
        failure: failed ? makeFailure("validators", failed) : null,
      });
    }

    if (
      validatorOptions.length === 0 &&
      (intent.selectedValidators?.length ?? 0) === 0
    ) {
      return makeEarnView({
        ...validatorStage,
        intent,
        status: "no-validators",
      });
    }
  }

  const selectedValidators = resolveValidators({
    entry,
    selectedValidators: intent.selectedValidators,
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
