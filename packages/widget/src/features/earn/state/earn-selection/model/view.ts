import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { filterValidators } from "../../../../../domain/earn/yield";
import { YieldId } from "../../../../../domain/identity/identifiers";
import { tokenString } from "../../../../../domain/token/token";
import type {
  DashboardYieldCategory,
  PreferredTokenYieldsPerNetwork,
} from "../../../../../public-api/types";
import type { EarnEntry, EarnEntryIntent, EarnSelectionView } from "../types";
import { canSubmitEarnForm, resolveForm } from "./form";
import { resolveToken } from "./token";
import { resolveValidators } from "./validators";
import {
  disabledValidatorsViewResource,
  type EarnResourceResult,
  type EarnViewObservations,
} from "./view-inputs";
import {
  type EarnViewFacts,
  makeEarnView,
  makeEmptyPositionsData,
} from "./view-model";
import { resolveYield, resolveYieldOptions } from "./yield";

const getAvailableValue = <A>(result: EarnResourceResult<A>, fallback: A): A =>
  AsyncResult.getOrElse(result, () => fallback);

const hasAvailableValue = <A>(result: EarnResourceResult<A>) =>
  Option.isSome(AsyncResult.value(result));

const isResolving = <A>(result: EarnResourceResult<A>) =>
  result.waiting ||
  (!hasAvailableValue(result) && !AsyncResult.isFailure(result));

const isBlockingFailure = <A>(result: EarnResourceResult<A>) =>
  AsyncResult.isFailure(result) && !hasAvailableValue(result);

const decodeInitYieldId = (entry: EarnEntry) =>
  entry.initParams?.yieldId
    ? Schema.decodeOption(YieldId)(entry.initParams.yieldId).pipe(
        Option.getOrNull
      )
    : null;

const findPreferredCategory = ({
  catalogs,
  preferred,
}: {
  readonly catalogs: Extract<
    EarnViewObservations["category"],
    { readonly _tag: "enabled" }
  >["catalogs"];
  readonly preferred: PreferredTokenYieldsPerNetwork | null;
}) =>
  catalogs.find(({ result }) => {
    const options = getAvailableValue(result, []);
    return options.some((option) => {
      const network = preferred?.[option.token.network];
      return !!network?.[tokenString(option.token)];
    });
  })?.category ?? null;

const resolveCategorySelection = ({
  entry,
  intent,
  observations,
  previous,
}: {
  readonly entry: EarnEntry;
  readonly intent: EarnEntryIntent;
  readonly observations: EarnViewObservations;
  readonly previous: EarnSelectionView | null;
}) => {
  if (observations.category._tag === "disabled") {
    return {
      available: [] as ReadonlyArray<DashboardYieldCategory>,
      blockingFailure: false,
      category: null,
      loading: false,
    };
  }

  const catalogs = observations.category.catalogs;
  const categoryResult = observations.category.result;
  const available = getAvailableValue(categoryResult, []);
  const initYieldId = decodeInitYieldId(entry);
  const initCategory = initYieldId
    ? (catalogs.find(({ result }) =>
        getAvailableValue(result, []).some((option) =>
          option.availableYields.includes(initYieldId)
        )
      )?.category ?? null)
    : null;
  const preferredCategory = findPreferredCategory({
    catalogs,
    preferred: entry.preferredTokenYieldsPerNetwork ?? null,
  });
  const candidates = [
    intent.selectedCategory,
    initCategory,
    previous?.selection.category ?? null,
    preferredCategory,
    ...entry.categoryOrder,
  ];

  return {
    available,
    blockingFailure: isBlockingFailure(categoryResult),
    category:
      candidates.find(
        (candidate): candidate is DashboardYieldCategory =>
          candidate !== null && available.includes(candidate)
      ) ?? null,
    loading: !hasAvailableValue(categoryResult) && isResolving(categoryResult),
  };
};

export const resolveEarnView = ({
  entry,
  intent,
  observations,
  previous = null,
}: {
  readonly entry: EarnEntry;
  readonly intent: EarnEntryIntent;
  readonly observations: EarnViewObservations;
  readonly previous?: EarnSelectionView | null;
}): EarnSelectionView => {
  const positions = observations.initial.positions;
  const positionsData = getAvailableValue(positions, makeEmptyPositionsData());
  const category = resolveCategorySelection({
    entry,
    intent,
    observations,
    previous,
  });
  const categoryFacts: EarnViewFacts = {
    availableCategories: category.available,
    blockingFailure: category.blockingFailure,
    empty: {
      categories:
        entry.dashboardVariant &&
        !category.loading &&
        !category.blockingFailure &&
        category.available.length === 0,
    },
    loading: { categories: category.loading },
    resources: {
      positions: { data: positionsData, waiting: positions.waiting },
    },
    selection: { category: category.category },
  };

  if (
    category.blockingFailure ||
    category.loading ||
    (entry.dashboardVariant && !category.category)
  ) {
    return makeEarnView({ ...categoryFacts, intent });
  }

  const tokenResult = observations.tokenOptions;
  const tokenOptions = getAvailableValue(tokenResult, []);
  const previousToken =
    previous?.selection.category === category.category
      ? previous.selection.token
      : null;
  const selectedToken = resolveToken({
    entry,
    previousToken,
    selectedTokenKey: intent.selectedTokenKey,
    tokenOptions,
  });
  const tokenLoading = isResolving(tokenResult) && tokenOptions.length === 0;
  const tokenFailure = isBlockingFailure(tokenResult);
  const tokenFacts: EarnViewFacts = {
    ...categoryFacts,
    blockingFailure: tokenFailure,
    empty: {
      ...categoryFacts.empty,
      tokens: !tokenLoading && !tokenFailure && tokenOptions.length === 0,
    },
    loading: {
      ...categoryFacts.loading,
      initialSelection:
        tokenLoading &&
        (!!entry.initParams?.token || !!entry.initParams?.yieldId),
      tokens: tokenLoading,
    },
    resources: {
      ...categoryFacts.resources,
      tokenOptions: { items: tokenOptions, waiting: tokenResult.waiting },
    },
  };

  if (!selectedToken || tokenFailure) {
    return makeEarnView({ ...tokenFacts, intent });
  }

  const yieldResult = observations.yieldCatalog;
  const yieldCatalog = getAvailableValue(yieldResult, []);
  const yieldOptions = resolveYieldOptions({
    selectedToken,
    yieldsById: yieldCatalog,
  });
  const previousYield =
    previous?.selection.token &&
    previous.selection.token.token.network === selectedToken.token.network
      ? previous.selection.yield
      : null;
  const selectedYield = resolveYield({
    entry,
    previousYield,
    selectedToken,
    selectedYieldId: intent.selectedYieldId,
    yieldOptions,
  });
  const yieldLoading = isResolving(yieldResult) && yieldOptions.length === 0;
  const yieldFailure = isBlockingFailure(yieldResult);
  const yieldFacts: EarnViewFacts = {
    ...tokenFacts,
    blockingFailure: yieldFailure,
    empty: {
      ...tokenFacts.empty,
      yields: !yieldLoading && !yieldFailure && yieldOptions.length === 0,
    },
    loading: { ...tokenFacts.loading, yields: yieldLoading },
    resources: {
      ...tokenFacts.resources,
      yields: { items: yieldOptions, waiting: yieldResult.waiting },
    },
    selection: { category: category.category, token: selectedToken },
  };

  if (!selectedYield || yieldFailure) {
    return makeEarnView({ ...yieldFacts, intent });
  }

  if (!hasAvailableValue(positions)) {
    return makeEarnView({
      ...yieldFacts,
      blockingFailure: isBlockingFailure(positions),
      intent,
      loading: {
        ...yieldFacts.loading,
        positions: isResolving(positions),
      },
      selection: {
        category: category.category,
        token: selectedToken,
        yield: selectedYield,
      },
    });
  }

  const validatorInput = observations.validators;
  const validatorOptions =
    validatorInput._tag === "enabled" ? validatorInput.options : [];
  const availableAmount =
    entry.walletScope && selectedToken.amount !== null
      ? selectedToken.amount
      : null;
  const form = resolveForm({
    availableAmount,
    intent,
    positionsData,
    selectedYield,
  });
  const validatorFacts: EarnViewFacts = {
    ...yieldFacts,
    form,
    resources: {
      ...yieldFacts.resources,
      validators:
        validatorInput._tag === "enabled"
          ? { enabled: true, items: validatorOptions, key: null }
          : disabledValidatorsViewResource,
    },
    selection: {
      category: category.category,
      token: selectedToken,
      yield: selectedYield,
    },
  };

  if (
    validatorInput._tag === "enabled" &&
    !hasAvailableValue(validatorInput.result)
  ) {
    return makeEarnView({
      ...validatorFacts,
      blockingFailure: isBlockingFailure(validatorInput.result),
      intent,
      loading: {
        ...validatorFacts.loading,
        validators: isResolving(validatorInput.result),
      },
    });
  }

  const selectedValidatorIntent =
    validatorInput._tag === "enabled" && intent.selectedValidators !== null
      ? filterValidators({
          network: selectedYield.token.network,
          validators: intent.selectedValidators,
          validatorsConfig: validatorInput.validatorsConfig,
          yieldId: selectedYield.id,
        })
      : null;
  const selectedValidators = resolveValidators({
    complete: validatorInput._tag === "enabled" && validatorInput.complete,
    entry,
    network: selectedYield.token.network,
    selectedValidators: selectedValidatorIntent,
    validatorOptions,
  });
  const validatorsEmpty =
    validatorInput._tag === "enabled" &&
    validatorOptions.length === 0 &&
    selectedValidators.length === 0;

  return makeEarnView({
    ...validatorFacts,
    can: {
      selectValidator: validatorInput._tag === "enabled",
      submit:
        entry.walletScope !== null &&
        availableAmount !== null &&
        (validatorInput._tag === "disabled" || selectedValidators.length > 0) &&
        canSubmitEarnForm({
          availableAmount,
          form,
          positionsData,
          selectedYield,
        }),
    },
    empty: { ...validatorFacts.empty, validators: validatorsEmpty },
    intent,
    selection: {
      category: category.category,
      token: selectedToken,
      validators: selectedValidators,
      yield: selectedYield,
    },
  });
};
