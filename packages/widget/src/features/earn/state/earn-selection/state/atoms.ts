import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/config/settings";
import {
  sameWalletScopeOwner,
  type WalletScopeOwnerKey,
  walletScopeFromState,
  walletScopeOwnerKey,
} from "../../../../../services/wallet/domain/scope";
import { disconnectedNormalizedWalletState } from "../../../../../services/wallet/domain/state";
import { initParamsAtom } from "../../../../init-params/state";
import { walletStateResultAtom } from "../../../../wallet/state";
import { makeResolvingWalletView } from "../model/view-model";
import {
  type EarnEntry,
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../types";
import type { EarnAction } from "./actions";
import { commitEarnInitialSelection } from "./initial-selection";
import { type EarnMachineState, reconcileEarnMachineOwner } from "./owner";
import { applyEarnAction } from "./reducer";
import { makeEarnResourceAdapter } from "./resource-observations";

const earnWalletSnapshotAtom = Atom.make((context) => {
  const result = context.get(walletStateResultAtom);
  const wallet = result.pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedNormalizedWalletState)
  );

  return {
    walletResolution:
      AsyncResult.isInitial(result) || wallet.status === "connecting"
        ? ("pending" as const)
        : ("settled" as const),
    walletScope: walletScopeFromState(wallet),
  };
}).pipe(Atom.withLabel("earnWalletSnapshotAtom"));

export const earnMachineEntryAtom = Atom.make<EarnEntry>((context) => {
  const config = context.get(widgetConfigAtom);
  const wallet = context.get(earnWalletSnapshotAtom);
  const initParams = context.get(initParamsAtom);

  return {
    categoryOrder: config.dashboardYieldCategoryOrder,
    dashboardVariant:
      !!config.dashboardVariant && config.yieldGrouping === "category",
    initParams,
    preferredTokenYieldsPerNetwork:
      config.preferredTokenYieldsPerNetwork ?? null,
    tokensForEnabledYieldsOnly: !!config.tokensForEnabledYieldsOnly,
    walletScope: wallet.walletScope,
    walletResolution: wallet.walletResolution,
  };
}).pipe(Atom.withLabel("earnMachineEntryAtom"));

const earnMachineStateAtom = Atom.writable<EarnMachineState, EarnMachineState>(
  (context) => {
    const entry = context.get(earnMachineEntryAtom);
    const scope = entry.walletScope;
    const owner = scope ? walletScopeOwnerKey(scope) : null;
    const previous = context.self<EarnMachineState>().pipe(Option.getOrNull);

    return reconcileEarnMachineOwner(
      previous,
      owner,
      entry.dashboardVariant,
      entry.walletResolution
    );
  },
  (context, state) => context.setSelf(state)
).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnMachineStateAtom"));

const earnInitialSelectionConsumedAtom = Atom.make(false).pipe(
  Atom.keepAlive,
  Atom.withLabel("earnInitialSelectionConsumedAtom")
);

type EarnMachineProjection = {
  readonly sourceState: EarnMachineState;
  readonly state: EarnMachineState;
  readonly view: EarnMachineView;
};

const hasSameOwner = (
  first: WalletScopeOwnerKey | null,
  second: WalletScopeOwnerKey | null
) => {
  if (!first || !second) {
    return first === second;
  }

  return sameWalletScopeOwner(first, second);
};

const isInitializationTerminal = (view: EarnMachineView): boolean =>
  view.status === "failed" ||
  view.status === "ready" ||
  view.status === "no-categories" ||
  view.status === "no-tokens" ||
  view.status === "no-yields" ||
  view.status === "no-validators";

const earnMachineProjectionAtom = Atom.readable<EarnMachineProjection>(
  (context) => {
    const baseEntry = context.get(earnMachineEntryAtom);
    const sourceState = context.get(earnMachineStateAtom);
    const previousMachine = context
      .self<EarnMachineProjection>()
      .pipe(Option.getOrNull);
    const reconciledState =
      previousMachine?.sourceState === sourceState
        ? previousMachine.state
        : sourceState;
    const state =
      context.once(earnInitialSelectionConsumedAtom) &&
      reconciledState.initializationPhase === "applying-init-params"
        ? {
            ...reconciledState,
            initializationPhase: "complete" as const,
          }
        : reconciledState;
    const entry = {
      ...baseEntry,
      initParams:
        state.initializationPhase === "applying-init-params"
          ? baseEntry.initParams
          : null,
    };
    const previousView =
      previousMachine && hasSameOwner(previousMachine.state.owner, state.owner)
        ? previousMachine.view
        : null;
    const view =
      entry.walletResolution === "pending"
        ? makeResolvingWalletView({
            intent: state.intent,
            previous: Option.fromNullishOr(previousView),
          })
        : (() => {
            const resources = makeEarnResourceAdapter(context);
            return resources.resolve({
              entry,
              intent: state.intent,
              previous: previousView,
            });
          })();

    const initializationComplete =
      state.initializationPhase === "applying-init-params" &&
      isInitializationTerminal(view);
    const committedState = initializationComplete
      ? {
          ...state,
          initializationPhase: "complete" as const,
          intent:
            view.status === "failed"
              ? state.intent
              : commitEarnInitialSelection(entry, state.intent, view),
        }
      : state;

    return { sourceState, state: committedState, view };
  }
).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnMachineProjectionAtom"));

export const earnMachineIntentAtom = Atom.writable<
  EarnMachineIntent,
  EarnAction
>(
  (context) => context.get(earnMachineProjectionAtom).state.intent,
  (context, action) => {
    const state = context.get(earnMachineProjectionAtom).state;
    const intent = applyEarnAction({ action, intent: state.intent });

    context.set(earnMachineStateAtom, { ...state, intent });
  }
).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnMachineIntentAtom"));

export const resetEarnEntryIntentForOwnerAtom = Atom.fnSync(
  (owner: WalletScopeOwnerKey, context) => {
    const state = context(earnMachineStateAtom);
    if (!state.owner || !sameWalletScopeOwner(state.owner, owner)) return;

    context.set(earnMachineStateAtom, {
      ...state,
      initializationPhase: "complete",
      intent: makeDefaultEarnIntent(),
    });
  }
).pipe(Atom.withLabel("resetEarnEntryIntentForOwnerAtom"));

export const earnMachineViewAtom = Atom.make((context) => {
  const projection = context.get(earnMachineProjectionAtom);
  if (
    projection.state.initializationPhase === "complete" &&
    !context.once(earnInitialSelectionConsumedAtom)
  ) {
    // The projection observes this marker with `once`, so recording the
    // application-generation fact cannot replace this terminal view.
    context.set(earnInitialSelectionConsumedAtom, true);
  }
  return projection.view;
}).pipe(Atom.setIdleTTL(0), Atom.withLabel("earnMachineViewAtom"));
