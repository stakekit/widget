import { Option, Schema } from "effect";

import { getConfidentialAssetToken } from "../../../../domain/earn/confidential";
import type { YieldCategory } from "../../../../domain/earn/contract";
import { filterValidators } from "../../../../domain/earn/yield";
import { orderYieldsByProvider } from "../../../../domain/earn/yield-provider-order";
import { YieldId } from "../../../../domain/identity/identifiers";
import {
  hostTokenKey,
  sameTokenContract,
} from "../../../../domain/token/token";
import {
  type Presentable,
  toPresentable,
} from "../../../../shared/effect/async-result";
import { canSubmitEarnForm, resolveForm } from "./form";
import { findReachableDefaultToken, resolveToken } from "./token";
import type {
  EarnCatalogError,
  EarnEntry,
  EarnEntryIntent,
  EarnSelectionView,
  EarnTokenOption,
} from "./types";
import { resolveValidators } from "./validators";
import {
  disabledValidatorsViewResource,
  type EarnViewObservations,
} from "./view-inputs";
import {
  type EarnViewFacts,
  makeEarnView,
  makeEmptyPositionsData,
} from "./view-model";
import { resolveYield, resolveYieldOptions } from "./yield";

type EarnPresentable<A> = Presentable<A, EarnCatalogError>;

const readyValue = <A>(presentable: EarnPresentable<A>, fallback: A): A =>
  presentable._tag === "Ready" ? presentable.value : fallback;

/**
 * A list loads until it has items: while nothing is shown yet, and while an
 * empty list revalidates.
 */
const isListLoading = (
  presentable: EarnPresentable<unknown>,
  items: ReadonlyArray<unknown>
) =>
  presentable._tag === "Loading" ||
  (presentable._tag === "Ready" &&
    presentable.refreshing &&
    items.length === 0);

const decodeInitYieldId = (entry: EarnEntry) =>
  entry.initParams?.yieldId
    ? Schema.decodeOption(YieldId)(entry.initParams.yieldId).pipe(
        Option.getOrNull
      )
    : null;

type CategoryCatalogs = Extract<
  EarnViewObservations["category"],
  { readonly _tag: "enabled" }
>["catalogs"];

/** A category, none, or "pending" while a catalog it depends on loads. */
type CategoryLookup = YieldCategory | "pending" | null;

/**
 * The first category, in category order, whose catalog lists a matching token
 * option; "pending" while a catalog before it has not answered. An empty or
 * failed catalog matches nothing.
 */
const findCategory = (
  catalogs: CategoryCatalogs,
  matches: (option: EarnTokenOption) => boolean
): CategoryLookup => {
  for (const { category, result } of catalogs) {
    const catalog = toPresentable(result);
    if (catalog._tag === "Loading") return "pending";
    if (readyValue(catalog, []).some(matches)) return category;
  }
  return null;
};

/**
 * The first candidate whose catalog lists tokens, decided as soon as no
 * candidate before it can still win; "pending" until then.
 */
const selectCategory = (
  catalogs: CategoryCatalogs,
  candidates: ReadonlyArray<CategoryLookup>
): CategoryLookup => {
  for (const candidate of candidates) {
    if (candidate === "pending") return candidate;
    const available =
      candidate &&
      findCategory(
        catalogs.filter(({ category }) => category === candidate),
        () => true
      );
    if (available) return available;
  }
  return null;
};

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
}): {
  readonly available: ReadonlyArray<YieldCategory>;
  readonly blockingFailure: boolean;
  readonly category: YieldCategory | null;
  readonly loading: boolean;
} => {
  if (observations.category._tag === "disabled") {
    return {
      available: [],
      blockingFailure: false,
      category: null,
      loading: false,
    };
  }

  const catalogs = observations.category.catalogs;
  const initYieldId = decodeInitYieldId(entry);
  const preferred = entry.preferredTokenYieldsPerNetwork ?? null;
  const selected = selectCategory(catalogs, [
    intent.selectedCategory,
    initYieldId
      ? findCategory(catalogs, (option) =>
          option.availableYields.includes(initYieldId)
        )
      : null,
    previous?.selection.category ?? null,
    preferred
      ? findCategory(
          catalogs,
          (option) =>
            !!preferred[option.token.network]?.[hostTokenKey(option.token)]
        )
      : null,
    ...entry.categoryOrder,
  ]);

  if (selected === "pending") {
    // No tabs until one of them is selected.
    return {
      available: [],
      blockingFailure: false,
      category: null,
      loading: true,
    };
  }

  return {
    available: catalogs
      .filter(({ result }) => readyValue(toPresentable(result), []).length > 0)
      .map(({ category }) => category),
    // Every catalog has answered, none with tokens.
    blockingFailure:
      selected === null &&
      catalogs.some(({ result }) => toPresentable(result)._tag === "Failed"),
    category: selected,
    loading: false,
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
  const presentedPositions = toPresentable(positions);
  const positionsData = readyValue(
    presentedPositions,
    makeEmptyPositionsData()
  );
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
        entry.categoryGrouping &&
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
    (entry.categoryGrouping && !category.category)
  ) {
    return makeEarnView({ ...categoryFacts, intent });
  }

  const tokenResult = observations.tokenOptions;
  const presentedTokens = toPresentable(tokenResult);
  const tokenOptions = readyValue(presentedTokens, []);
  const tokenLoading = isListLoading(presentedTokens, tokenOptions);
  const tokenFailure = presentedTokens._tag === "Failed";
  const reachableDefaultYields =
    observations.reachableDefaultYields &&
    toPresentable(observations.reachableDefaultYields);
  const reachableDefaultLoading = reachableDefaultYields?._tag === "Loading";
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
        reachableDefaultLoading ||
        (tokenLoading &&
          (!!entry.initParams?.token || !!entry.initParams?.yieldId)),
      tokens: tokenLoading,
    },
    resources: {
      ...categoryFacts.resources,
      tokenOptions: { items: tokenOptions, waiting: tokenResult.waiting },
    },
  };

  // Waits rather than show a yield the user cannot reach and then switch.
  if (reachableDefaultLoading) {
    return makeEarnView({ ...tokenFacts, intent });
  }

  const previousToken =
    previous?.selection.category === category.category
      ? previous.selection.token
      : null;
  const selectedToken =
    (reachableDefaultYields
      ? findReachableDefaultToken({
          entry,
          positions: positionsData,
          tokenOptions,
          yields: readyValue(reachableDefaultYields, []),
        })
      : null) ??
    resolveToken({
      entry,
      previousToken,
      selectedTokenKey: intent.selectedTokenKey,
      tokenOptions,
    });

  if (!selectedToken || tokenFailure) {
    return makeEarnView({ ...tokenFacts, intent });
  }

  const yieldResult = observations.yieldCatalog;
  const presentedYields = toPresentable(yieldResult);
  const yieldCatalog = readyValue(presentedYields, []);
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
    positions: positionsData,
    previousYield,
    selectedToken,
    selectedYieldId: intent.selectedYieldId,
    yieldOptions,
  });
  const yieldLoading = isListLoading(presentedYields, yieldOptions);
  const yieldFailure = presentedYields._tag === "Failed";
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
      yields: {
        items: orderYieldsByProvider(
          yieldOptions,
          entry.yieldProviderOrder ?? {}
        ),
        waiting: yieldResult.waiting,
      },
    },
    selection: { category: category.category, token: selectedToken },
  };

  if (!selectedYield || yieldFailure) {
    return makeEarnView({ ...yieldFacts, intent });
  }

  if (presentedPositions._tag !== "Ready") {
    return makeEarnView({
      ...yieldFacts,
      blockingFailure: presentedPositions._tag === "Failed",
      intent,
      loading: {
        ...yieldFacts.loading,
        positions: presentedPositions._tag === "Loading",
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
  const confidentialAsset = getConfidentialAssetToken(selectedYield);
  // Unknown to the API (not zero); checked at review.
  const hiddenTokenBalance =
    confidentialAsset !== null &&
    sameTokenContract(confidentialAsset, selectedToken.token);
  const selectionToken = hiddenTokenBalance
    ? { ...selectedToken, amount: null }
    : selectedToken;
  const availableAmount =
    entry.walletScope && selectionToken.amount !== null
      ? selectionToken.amount
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
      token: selectionToken,
      yield: selectedYield,
    },
  };

  const presentedValidators =
    validatorInput._tag === "enabled"
      ? toPresentable(validatorInput.result)
      : null;
  if (presentedValidators && presentedValidators._tag !== "Ready") {
    return makeEarnView({
      ...validatorFacts,
      blockingFailure: presentedValidators._tag === "Failed",
      intent,
      loading: {
        ...validatorFacts.loading,
        validators: presentedValidators._tag === "Loading",
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
  const requestedLookup =
    validatorInput._tag === "enabled" && validatorInput.requested
      ? toPresentable(validatorInput.requested)
      : null;
  const selectedValidators = resolveValidators({
    complete: validatorInput._tag === "enabled" && validatorInput.complete,
    requestedMatch: requestedLookup ? readyValue(requestedLookup, null) : null,
    requestedValidator: intent.requestedValidator,
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
        (availableAmount !== null || hiddenTokenBalance) &&
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
    loading: {
      ...validatorFacts.loading,
      validators:
        requestedLookup?._tag === "Loading" ||
        (requestedLookup?._tag === "Ready" && requestedLookup.refreshing),
    },
    selection: {
      category: category.category,
      token: selectionToken,
      validators: selectedValidators,
      yield: selectedYield,
    },
  });
};
