import { Cause, Option, Schema, Stream } from "effect";
import type { AsyncResult as AsyncResultValue } from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYield,
} from "../../../../../domain/schema/earn-models";
import { YieldId } from "../../../../../domain/schema/identifiers";
import { Network } from "../../../../../domain/schema/network-model";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import {
  type PullPage,
  withPullPageDone,
} from "../../../../../shared/effect/pagination";
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
  EarnEntry,
  EarnMachineIntent,
  EarnTokenOption,
  EarnValidatorsResource,
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
  atom: Atom.Atom<AsyncResultValue<A, EarnCatalogError>>
) => {
  const result = context.get(atom);

  return {
    observation: observeAsyncResult(result),
    retryTargetAtom: atom,
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

const emptyValidatorsMapAtom = Atom.writable<
  Map<EarnValidatorKey, EarnValidator>,
  ReadonlyArray<EarnValidator>
>(
  () => new Map<EarnValidatorKey, EarnValidator>(),
  () => {}
);

const emptyValidatorsPullAtom = Atom.pull<
  PullPage<EarnValidator>,
  EarnCatalogError
>(Stream.succeed({ hasNextPage: false, items: [] })).pipe(withPullPageDone);

const disabledValidatorsResource: EarnValidatorsResource = {
  enabled: false,
  initialValidatorsResultAtom: Atom.make(
    AsyncResult.success<ReadonlyArray<EarnValidator>, EarnCatalogError>([])
  ),
  loadedValidatorsAtom: emptyValidatorsMapAtom,
  validatorsPullAtom: () => emptyValidatorsPullAtom,
};

const toValidatorsViewResource = (
  resource: EarnValidatorsResource
): EarnValidatorsViewResource => ({
  enabled: resource.enabled,
  loadedValidatorsAtom: resource.loadedValidatorsAtom,
  validatorsPullAtom: resource.validatorsPullAtom,
});

export const disabledValidatorsViewResource = toValidatorsViewResource(
  disabledValidatorsResource
);

export const pendingTokenOptionsPullAtom = Atom.pull<
  PullPage<EarnTokenOption>,
  EarnCatalogError
>(Stream.never).pipe(withPullPageDone);

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
  const initYield = readAsyncAtom(
    context,
    initYieldAtom(new InitYieldKey({ yieldId: selectionSeedYieldId }))
  );
  const positions = readAsyncAtom(
    context,
    positionsDataAtom(new PositionsDataKey({ scope: entry.walletScope }))
  );

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

  const atom = availableYieldCategoriesAtom(
    new AvailableYieldCategoriesKey({
      network,
      categoryOrder: entry.categoryOrder,
    })
  );

  return {
    _tag: "enabled",
    ...readAsyncAtom(context, atom),
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
  const pullAtom = tokenOptionsPullAtom(
    new DefaultTokenOptionsKey({
      network: entry.walletScope?.network ?? null,
      category,
      tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
    })
  );
  const atom = mergedTokenOptionsAtom(
    new TokenOptionsKey({
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
    })
  );

  return {
    ...readAsyncAtom(context, atom),
    pullAtom,
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
  const atom = earnYieldCatalogAtom(
    new YieldCatalogKey({
      category,
      network: selectedToken.token.network,
      yieldIds: selectedToken.availableYields,
    })
  );
  const result = context.get(atom);

  return {
    observation: observeAsyncResult(result),
    retryTargetAtom: atom,
    waiting: result.waiting,
  };
};

export const readValidatorInput = ({
  context,
  selectedYield,
  validatorSelectionRequired,
}: {
  readonly context: Atom.AtomContext;
  readonly selectedYield: EarnYield;
  readonly validatorSelectionRequired: boolean;
}) => {
  if (!validatorSelectionRequired) {
    return {
      _tag: "disabled",
      resource: disabledValidatorsViewResource,
    } as const;
  }

  const resource = yieldValidatorsAtom(
    new YieldValidatorsKey({
      network: selectedYield.token.network,
      selectedYieldId: selectedYield.id,
    })
  );
  const initial = readAsyncAtom(context, resource.initialValidatorsResultAtom);

  return {
    _tag: "enabled",
    initial,
    options: [...context.get(resource.loadedValidatorsAtom).values()],
    resource: toValidatorsViewResource(resource),
  } as const;
};
