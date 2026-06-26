import { Option, pipe } from "effect";
import type { AsyncResult as AsyncResultValue } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  getDashboardYieldCategory,
  isYieldValidatorSelectionRequired,
} from "../../../../../../domain/types/yields";
import type { ValidatorDto } from "../../../../../../generated/api/yield";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  tokenOptionsPullAtom,
  yieldValidatorsAtom,
} from "../catalog/atoms";
import {
  AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../catalog/keys";
import type {
  EarnCatalogError,
  EarnEntryKey,
  EarnMachineForm,
  EarnMachineIntent,
  EarnMachineView,
  EarnValidatorsResource,
  EarnYieldOption,
} from "../types";
import { resolveCategory } from "./category";
import { resolveForm } from "./form";
import {
  isResolvingInitialSelection,
  isResolvingTokenOptions,
  isResolvingYields,
} from "./status";
import { resolveToken } from "./token";
import { resolveValidators } from "./validators";
import { resolveYield, resolveYieldOptions } from "./yield";

const getAsyncValue = <A>(result: AsyncResultValue<A, EarnCatalogError>) =>
  pipe(result, AsyncResult.value, Option.getOrNull);

const getIntentForm = (intent: EarnMachineIntent): EarnMachineForm => ({
  providerYieldId: intent.selectedProviderYieldId,
  stakeAmount: intent.stakeAmount,
  tronResource: intent.tronResource,
  useMaxAmount: intent.useMaxAmount,
});

const mergeYieldOptions = (yields: ReadonlyArray<EarnYieldOption | null>) => {
  const byId = new Map<string, EarnYieldOption>();

  yields.forEach((yieldDto) => {
    if (yieldDto) {
      byId.set(yieldDto.id, yieldDto);
    }
  });

  return [...byId.values()];
};

const emptyValidatorsMapAtom = Atom.writable<
  Map<ValidatorDto["address"], ValidatorDto>,
  ReadonlyArray<ValidatorDto>
>(
  () => new Map<ValidatorDto["address"], ValidatorDto>(),
  () => {}
);

const emptyValidatorsPullAtom = Atom.writable<
  Atom.PullResult<ValidatorDto, EarnCatalogError>,
  void
>(
  () =>
    AsyncResult.success({
      done: true,
      items: [] as unknown as [ValidatorDto, ...ValidatorDto[]],
    }),
  () => {}
);

const disabledValidatorsResource = {
  enabled: false,
  loadedValidatorsAtom: emptyValidatorsMapAtom,
  validatorsPullAtom: () => emptyValidatorsPullAtom,
} satisfies EarnValidatorsResource;

export const resolveEarnView = ({
  context,
  entry,
  intent,
}: {
  context: Atom.AtomContext;
  entry: EarnEntryKey;
  intent: EarnMachineIntent;
}): EarnMachineView => {
  const initYieldAtomValue = initYieldAtom(
    new InitYieldKey({ yieldId: entry.initParams?.yieldId ?? null })
  );
  const initYieldResult = context.get(initYieldAtomValue);
  const initYield = getAsyncValue(initYieldResult);
  const initYieldCategory = entry.dashboardVariant
    ? initYield
      ? getDashboardYieldCategory(initYield)
      : null
    : null;
  const availableCategoriesAtom = entry.dashboardVariant
    ? availableYieldCategoriesAtom(
        new AvailableYieldCategoriesKey({
          network: entry.network,
          categoryOrder: entry.categoryOrder,
        })
      )
    : null;

  const availableCategories = availableCategoriesAtom
    ? pipe(
        context.get(availableCategoriesAtom),
        AsyncResult.value,
        Option.getOrElse(() => [])
      )
    : [];

  const category = resolveCategory({
    availableCategories,
    categoryOrder: entry.categoryOrder,
    selectedCategory: intent.selectedCategory ?? initYieldCategory,
    dashboardVariant: entry.dashboardVariant,
  });

  const tokenOptionsPullAtomValue = tokenOptionsPullAtom(
    new DefaultTokenOptionsKey({
      network: entry.network,
      category,
      tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
    })
  );
  const tokenOptionsAtom = mergedTokenOptionsAtom(
    new TokenOptionsKey({
      address: entry.address,
      additionalAddresses: entry.additionalAddresses,
      network: entry.network,
      category,
      initToken: entry.initParams?.token ?? null,
      initTokenNetwork: entry.initParams?.network ?? null,
      initYieldId: entry.initParams?.yieldId ?? null,
      tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
    })
  );
  const tokenOptions = context.get(tokenOptionsAtom);
  const positionsDataAtomValue = positionsDataAtom(
    new PositionsDataKey({
      address: entry.address,
      network: entry.network,
    })
  );
  const positionsData =
    getAsyncValue(context.get(positionsDataAtomValue)) ?? new Map();

  if (
    !intent.selectedTokenKey &&
    !intent.selectedYieldId &&
    isResolvingInitialSelection({ entry, tokenOptions })
  ) {
    return {
      status: "loading-initial-selection",
      availableCategories,
      selection: {
        category,
        token: null,
        validators: [],
        yield: null,
      },
      form: getIntentForm(intent),
      resources: {
        yieldsResult: null,
        initYieldAtom: initYieldAtomValue,
        positionsDataAtom: positionsDataAtomValue,
        tokenOptionsAtom,
        tokenOptionsPullAtom: tokenOptionsPullAtomValue,
        validators: disabledValidatorsResource,
      },
      can: {
        selectToken: tokenOptions.items.length > 0,
        selectYield: false,
        selectValidator: false,
        submit: false,
      },
    };
  }

  const selectedToken = resolveToken({
    entry,
    selectedTokenKey: intent.selectedTokenKey,
    tokenOptions,
  });

  if (!selectedToken) {
    return {
      status: isResolvingTokenOptions(tokenOptions)
        ? "loading-token-options"
        : "no-tokens",
      availableCategories,
      selection: {
        category,
        token: null,
        validators: [],
        yield: null,
      },
      form: getIntentForm(intent),
      resources: {
        yieldsResult: null,
        initYieldAtom: initYieldAtomValue,
        positionsDataAtom: positionsDataAtomValue,
        tokenOptionsAtom,
        tokenOptionsPullAtom: tokenOptionsPullAtomValue,
        validators: disabledValidatorsResource,
      },
      can: {
        selectToken: tokenOptions.items.length > 0,
        selectYield: false,
        selectValidator: false,
        submit: false,
      },
    };
  }

  const yieldCatalogAtom = earnYieldCatalogAtom(
    new YieldCatalogKey({
      selectedToken,
      category,
    })
  );
  const yieldCatalogResult = context.get(yieldCatalogAtom);
  const yieldsResult = yieldCatalogResult.pipe(
    AsyncResult.map((catalogYieldOptions) =>
      resolveYieldOptions({
        selectedToken,
        yieldsById: mergeYieldOptions([...catalogYieldOptions, initYield]),
      })
    )
  );
  const yieldOptions = getAsyncValue(yieldsResult) ?? [];
  const selectedYield = resolveYield({
    entry,
    positionsData,
    selectedToken,
    selectedYieldId: intent.selectedYieldId,
    yieldOptions,
  });

  if (!selectedYield) {
    return {
      status: isResolvingYields(yieldsResult) ? "loading-yields" : "no-yields",
      availableCategories,
      selection: {
        category,
        token: selectedToken,
        validators: [],
        yield: null,
      },
      form: getIntentForm(intent),
      resources: {
        yieldsResult,
        initYieldAtom: initYieldAtomValue,
        positionsDataAtom: positionsDataAtomValue,
        tokenOptionsAtom,
        tokenOptionsPullAtom: tokenOptionsPullAtomValue,
        validators: disabledValidatorsResource,
      },
      can: {
        selectToken: tokenOptions.items.length > 0,
        selectYield: yieldOptions.length > 0,
        selectValidator: false,
        submit: false,
      },
    };
  }

  const validators = isYieldValidatorSelectionRequired(selectedYield)
    ? ({
        ...yieldValidatorsAtom(
          new YieldValidatorsKey({ selectedYieldId: selectedYield.id })
        ),
        enabled: true,
      } satisfies EarnValidatorsResource)
    : disabledValidatorsResource;
  const validatorOptions = validators.enabled
    ? [...context.get(validators.loadedValidatorsAtom).values()]
    : [];
  const selectedValidators = resolveValidators({
    entry,
    selectedValidatorKeys: intent.selectedValidatorKeys,
    validatorOptions,
  });

  return {
    status: "ready",
    availableCategories,
    selection: {
      category,
      token: selectedToken,
      validators: selectedValidators,
      yield: selectedYield,
    },
    form: resolveForm({
      intent,
      positionsData,
      selectedYield,
    }),
    resources: {
      yieldsResult,
      initYieldAtom: initYieldAtomValue,
      positionsDataAtom: positionsDataAtomValue,
      tokenOptionsAtom,
      tokenOptionsPullAtom: tokenOptionsPullAtomValue,
      validators,
    },
    can: {
      selectToken: tokenOptions.items.length > 0,
      selectYield: yieldOptions.length > 0,
      selectValidator: validators.enabled,
      submit: !validators.enabled || selectedValidators.length > 0,
    },
  };
};
