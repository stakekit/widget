import { Cause, Option, Schema } from "effect";
import type { AsyncResult as AsyncResultValue } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import { YieldId } from "../../../../../domain/schema/identifiers";
import { Network } from "../../../../../domain/schema/network-model";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  yieldValidatorsAtom,
} from "../resources/atoms";
import {
  AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../resources/keys";
import type {
  EarnCatalogError,
  EarnEntry,
  EarnMachineIntent,
  EarnRetryTarget,
  EarnTokenOption,
  EarnValidatorsViewResource,
} from "../types";

export type ResourceObservation<A> =
  | {
      readonly _tag: "available";
      readonly value: A;
      readonly waiting: boolean;
    }
  | { readonly _tag: "loading" }
  | { readonly _tag: "failed"; readonly error: EarnCatalogError };

const observeAsyncResult = <A>(
  result: AsyncResultValue<A, EarnCatalogError>
): ResourceObservation<A> => {
  const value = AsyncResult.value(result);

  if (Option.isSome(value)) {
    return {
      _tag: "available",
      value: value.value,
      waiting: result.waiting,
    };
  }

  if (AsyncResult.isFailure(result)) {
    const error = Cause.findErrorOption(result.cause);
    if (Option.isSome(error)) {
      return { _tag: "failed", error: error.value };
    }
  }

  return { _tag: "loading" };
};

const readAsyncAtom = <A>(
  context: Atom.AtomContext,
  atom: Atom.Atom<AsyncResultValue<A, EarnCatalogError>>,
  retryTarget: EarnRetryTarget
) => {
  const result = context.get(atom);

  return {
    observation: observeAsyncResult(result),
    retryTarget,
    waiting: result.waiting,
  };
};

const getPreferredTokenNetwork = (
  entry: EarnEntry,
  network: Network | null
): Network | null => {
  if (network && entry.preferredTokenYieldsPerNetwork?.[network]) {
    return network;
  }

  const firstConfiguredNetwork = Object.keys(
    entry.preferredTokenYieldsPerNetwork ?? {}
  )[0];

  return firstConfiguredNetwork
    ? Schema.decodeUnknownOption(Network)(firstConfiguredNetwork).pipe(
        Option.getOrNull
      )
    : null;
};

export const disabledValidatorsViewResource: EarnValidatorsViewResource = {
  enabled: false,
  items: [],
  key: null,
};

export const readInitialViewInputs = ({
  context,
  entry,
  intent,
}: {
  readonly context: Atom.AtomContext;
  readonly entry: EarnEntry;
  readonly intent: EarnMachineIntent;
}) => {
  const initYieldId = entry.initParams?.yieldId
    ? Schema.decodeOption(YieldId)(entry.initParams.yieldId).pipe(
        Option.getOrNull
      )
    : null;
  const selectionSeedYieldId = intent.selectedYieldId ?? initYieldId;
  const initYieldKey = new InitYieldKey({ yieldId: selectionSeedYieldId });
  const initYield = readAsyncAtom(context, initYieldAtom(initYieldKey), {
    _tag: "InitYield",
    key: initYieldKey,
  });
  const positionsKey = new PositionsDataKey({ scope: entry.walletScope });
  const positions = readAsyncAtom(context, positionsDataAtom(positionsKey), {
    _tag: "PositionsData",
    key: positionsKey,
  });

  return {
    initYield,
    initYieldId,
    network: entry.walletScope?.network ?? null,
    positions,
    selectionSeedYieldId,
  };
};

export const readCategoryInput = ({
  context,
  entry,
  network,
}: {
  readonly context: Atom.AtomContext;
  readonly entry: EarnEntry;
  readonly network: Network | null;
}) => {
  if (!entry.dashboardVariant) {
    return { _tag: "disabled" } as const;
  }

  const key = new AvailableYieldCategoriesKey({
    network,
    categoryOrder: entry.categoryOrder,
  });

  return {
    _tag: "enabled",
    ...readAsyncAtom(context, availableYieldCategoriesAtom(key), {
      _tag: "AvailableCategories",
      key,
    }),
  } as const;
};

export const readTokenOptionsInput = ({
  category,
  context,
  entry,
  selectionSeedYieldId,
}: {
  readonly category: DashboardYieldCategory | null;
  readonly context: Atom.AtomContext;
  readonly entry: EarnEntry;
  readonly selectionSeedYieldId: YieldId | null;
}) => {
  const preferredTokenNetwork = getPreferredTokenNetwork(
    entry,
    entry.walletScope?.network ?? null
  );
  const pullKey = new DefaultTokenOptionsKey({
    network: entry.walletScope?.network ?? null,
    category,
    tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
  });
  const key = new TokenOptionsKey({
    scope: entry.walletScope,
    category,
    initToken: entry.initParams?.token ?? null,
    initTokenNetwork: entry.initParams?.network ?? null,
    initYieldId: selectionSeedYieldId,
    preferredTokenNetwork,
    preferredTokenKeys: preferredTokenNetwork
      ? Object.keys(
          entry.preferredTokenYieldsPerNetwork?.[preferredTokenNetwork] ?? {}
        )
      : [],
    tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
  });

  return {
    ...readAsyncAtom(context, mergedTokenOptionsAtom(key), {
      _tag: "TokenOptions",
      key,
    }),
    pullKey,
  };
};

export const readYieldCatalogInput = ({
  category,
  context,
  selectedToken,
}: {
  readonly category: DashboardYieldCategory | null;
  readonly context: Atom.AtomContext;
  readonly selectedToken: EarnTokenOption;
}) => {
  const key = new YieldCatalogKey({
    category,
    network: selectedToken.token.network,
    yieldIds: selectedToken.availableYields,
  });

  return readAsyncAtom(context, earnYieldCatalogAtom(key), {
    _tag: "YieldCatalog",
    key,
  });
};

export const readValidatorInput = ({
  context,
  selectedYield,
  validatorSelectionRequired,
}: {
  readonly context: Atom.AtomContext;
  readonly selectedYield: EarnYieldWithProvider;
  readonly validatorSelectionRequired: boolean;
}) => {
  if (!validatorSelectionRequired) {
    return {
      _tag: "disabled",
      resource: disabledValidatorsViewResource,
    } as const;
  }

  const key = new YieldValidatorsKey({
    network: selectedYield.token.network,
    selectedYieldId: selectedYield.id,
  });
  const resource = yieldValidatorsAtom(key);
  const initial = readAsyncAtom(context, resource.initialValidatorsResultAtom, {
    _tag: "YieldValidators",
    key,
  });
  const known = new Map<EarnValidatorKey, EarnValidator>(
    initial.observation._tag === "available"
      ? initial.observation.value.map((validator) => [validator.key, validator])
      : []
  );
  context
    .get(resource.rememberValidatorsAtom)
    .forEach((validator, validatorKey) => known.set(validatorKey, validator));
  const options = [...known.values()];

  return {
    _tag: "enabled",
    initial,
    options,
    resource: {
      enabled: true,
      items: options,
      key,
    } satisfies EarnValidatorsViewResource,
  } as const;
};
