import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { isYieldValidatorSelectionRequired } from "../../../../../domain/earn/yield";
import { YieldId } from "../../../../../domain/identity/identifiers";
import { Network } from "../../../../../domain/network/network";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  yieldValidatorsAtom,
} from "../catalog/catalog";
import {
  AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../catalog/keys";
import { resolveEarnView } from "../model/view";
import type {
  CategoryObservation,
  EarnResourceResult,
  EarnViewObservations,
  InitialViewObservations,
  ValidatorObservation,
} from "../model/view-inputs";
import type {
  EarnEntry,
  EarnMachineView,
  EarnRetryTarget,
  EarnTokenOption,
} from "../types";

const readAsyncAtom = <A>(
  context: Atom.AtomContext,
  atom: Atom.Atom<EarnResourceResult<A>>
): EarnResourceResult<A> => context.get(atom);

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

type RetryStage = NonNullable<EarnMachineView["failure"]>["stage"];
type EarnViewResolutionInput = Omit<
  Parameters<typeof resolveEarnView>[0],
  "observations"
>;

export const makeEarnResourceAdapter = (context: Atom.AtomContext) => {
  const retryTargets = new Map<RetryStage, EarnRetryTarget>();
  let tokenOptionsPullKey: DefaultTokenOptionsKey | null = null;
  let validatorsKey: YieldValidatorsKey | null = null;

  const readInitial = ({
    entry,
    intent,
  }: Pick<
    Parameters<typeof resolveEarnView>[0],
    "entry" | "intent"
  >): InitialViewObservations => {
    const initYieldId = entry.initParams?.yieldId
      ? Schema.decodeOption(YieldId)(entry.initParams.yieldId).pipe(
          Option.getOrNull
        )
      : null;
    const selectionSeedYieldId = intent.selectedYieldId ?? initYieldId;
    const initYieldKey = new InitYieldKey({ yieldId: selectionSeedYieldId });
    const positionsKey = new PositionsDataKey({ scope: entry.walletScope });
    const initYield = readAsyncAtom(context, initYieldAtom(initYieldKey));
    const positions = readAsyncAtom(context, positionsDataAtom(positionsKey));
    retryTargets.set("positions", {
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

  const readCategory = ({
    entry,
    network,
  }: {
    readonly entry: EarnEntry;
    readonly network: Network | null;
  }): CategoryObservation => {
    if (!entry.dashboardVariant) return { _tag: "disabled" };

    const key = new AvailableYieldCategoriesKey({
      categoryOrder: entry.categoryOrder,
      network,
    });
    retryTargets.set("categories", {
      _tag: "AvailableCategories",
      key,
    });
    return {
      _tag: "enabled",
      result: readAsyncAtom(context, availableYieldCategoriesAtom(key)),
    };
  };

  const readTokenOptions = ({
    category,
    entry,
    selectionSeedYieldId,
  }: {
    readonly category: DashboardYieldCategory | null;
    readonly entry: EarnEntry;
    readonly selectionSeedYieldId: YieldId | null;
  }): EarnResourceResult<ReadonlyArray<EarnTokenOption>> => {
    const preferredTokenNetwork = getPreferredTokenNetwork(
      entry,
      entry.walletScope?.network ?? null
    );
    tokenOptionsPullKey = new DefaultTokenOptionsKey({
      category,
      network: entry.walletScope?.network ?? null,
      tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
    });
    const key = new TokenOptionsKey({
      category,
      initToken: entry.initParams?.token ?? null,
      initTokenNetwork: entry.initParams?.network ?? null,
      initYieldId: selectionSeedYieldId,
      preferredTokenKeys: preferredTokenNetwork
        ? Object.keys(
            entry.preferredTokenYieldsPerNetwork?.[preferredTokenNetwork] ?? {}
          )
        : [],
      preferredTokenNetwork,
      scope: entry.walletScope,
      tokensForEnabledYieldsOnly: !!entry.tokensForEnabledYieldsOnly,
    });
    const retryTarget = { _tag: "TokenOptions", key } as const;
    retryTargets.set("initial-selection", retryTarget);
    retryTargets.set("token-options", retryTarget);
    return readAsyncAtom(context, mergedTokenOptionsAtom(key));
  };

  const readYieldCatalog = ({
    category,
    selectedToken,
  }: {
    readonly category: DashboardYieldCategory | null;
    readonly selectedToken: EarnTokenOption;
  }): EarnResourceResult<ReadonlyArray<EarnYieldWithProvider>> => {
    const key = new YieldCatalogKey({
      category,
      network: selectedToken.token.network,
      yieldIds: selectedToken.availableYields,
    });
    retryTargets.set("yields", { _tag: "YieldCatalog", key });
    return readAsyncAtom(context, earnYieldCatalogAtom(key));
  };

  const readValidators = ({
    selectedYield,
    validatorSelectionRequired,
  }: {
    readonly selectedYield: EarnYieldWithProvider;
    readonly validatorSelectionRequired: boolean;
  }): ValidatorObservation => {
    if (!validatorSelectionRequired) return { _tag: "disabled" };

    validatorsKey = new YieldValidatorsKey({
      network: selectedYield.token.network,
      selectedYieldId: selectedYield.id,
    });
    const resource = yieldValidatorsAtom(validatorsKey);
    const initial = readAsyncAtom(
      context,
      resource.initialValidatorsResultAtom
    );
    retryTargets.set("validators", {
      _tag: "YieldValidators",
      key: validatorsKey,
    });
    return {
      _tag: "enabled",
      options: initial.pipe(
        AsyncResult.value,
        Option.getOrElse(() => [])
      ),
      result: initial,
    };
  };

  const bind = (view: EarnMachineView): EarnMachineView => ({
    ...view,
    retryTarget: view.failure
      ? (retryTargets.get(view.failure.stage) ?? null)
      : null,
    resources: {
      ...view.resources,
      tokenOptions: {
        ...view.resources.tokenOptions,
        pullKey: tokenOptionsPullKey,
      },
      validators: {
        ...view.resources.validators,
        key: view.resources.validators.enabled ? validatorsKey : null,
      },
    },
  });

  const resolve = ({
    entry,
    intent,
    previous,
  }: EarnViewResolutionInput): EarnMachineView => {
    const initial = readInitial({ entry, intent });
    const category = readCategory({ entry, network: initial.network });
    const loading = <A>(): EarnResourceResult<A> => AsyncResult.initial();
    const makeObservations = (
      values: Partial<EarnViewObservations>
    ): EarnViewObservations => ({
      category,
      initial,
      tokenOptions: loading(),
      validators: { _tag: "disabled" },
      yieldCatalog: loading(),
      ...values,
    });
    let observations = makeObservations({});
    let view = resolveEarnView({ entry, intent, observations, previous });

    if (
      category._tag === "enabled" &&
      (Option.isNone(AsyncResult.value(category.result)) ||
        AsyncResult.getOrElse(category.result, () => []).length === 0)
    ) {
      return bind(view);
    }

    const tokenOptions = readTokenOptions({
      category: view.selection.category,
      entry,
      selectionSeedYieldId: initial.selectionSeedYieldId,
    });
    observations = makeObservations({ tokenOptions });
    view = resolveEarnView({ entry, intent, observations, previous });
    if (!view.selection.token) return bind(view);

    const yieldCatalog = readYieldCatalog({
      category: view.selection.category,
      selectedToken: view.selection.token,
    });
    observations = makeObservations({ tokenOptions, yieldCatalog });
    view = resolveEarnView({ entry, intent, observations, previous });
    if (!view.selection.yield) return bind(view);

    const validators = readValidators({
      selectedYield: view.selection.yield,
      validatorSelectionRequired: isYieldValidatorSelectionRequired(
        view.selection.yield
      ),
    });
    observations = makeObservations({
      tokenOptions,
      validators,
      yieldCatalog,
    });
    return bind(resolveEarnView({ entry, intent, observations, previous }));
  };

  return { resolve } as const;
};
