import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/config/settings";
import { walletScopeOwnerKey } from "../../../../../services/wallet/domain/scope";
import { initParamsAtom } from "../../../../init-params/atoms";
import {
  currentWalletScopeAtom,
  selectCurrentWalletAtom,
} from "../../../../wallet/state/selectors";
import { resolveEarnView } from "../resolver/view";
import { makeResolvingWalletView } from "../resolver/view-model";
import type { EarnEntry, EarnMachineIntent, EarnMachineView } from "../types";
import type { EarnAction } from "./actions";
import {
  type EarnMachineState,
  reconcileEarnMachineOwner,
  reconcileEarnMachineView,
  shouldConsumeEarnInitialization,
} from "./owner";
import { applyEarnAction } from "./reducer";

const earnWalletStateAtom = selectCurrentWalletAtom((state) => state);

export const earnMachineEntryAtom = Atom.make<EarnEntry>((context) => {
  const config = context.get(widgetConfigAtom);
  const wallet = context.get(earnWalletStateAtom);
  const walletScope = context.get(currentWalletScopeAtom);
  const initParams = context.get(initParamsAtom);

  return {
    categoryOrder: config.dashboardYieldCategoryOrder,
    dashboardVariant:
      !!config.dashboardVariant && config.yieldGrouping === "category",
    initParams,
    preferredTokenYieldsPerNetwork:
      config.preferredTokenYieldsPerNetwork ?? null,
    tokensForEnabledYieldsOnly: !!config.tokensForEnabledYieldsOnly,
    walletScope,
    walletResolution: wallet.status === "connecting" ? "pending" : "settled",
  };
}).pipe(Atom.withLabel("earnMachineEntryAtom"));

type EarnMachineCommand =
  | EarnAction
  | {
      readonly type: "machine/reconcile";
      readonly consumeInitialization: boolean;
      readonly intent: EarnMachineIntent;
    };

const earnMachineStateAtom = Atom.writable<
  EarnMachineState,
  EarnMachineCommand
>(
  (context) => {
    const entry = context.get(earnMachineEntryAtom);
    const scope = entry.walletScope;
    const owner = scope ? walletScopeOwnerKey(scope) : null;
    const previous = context.self<EarnMachineState>().pipe(Option.getOrNull);

    if (entry.walletResolution === "pending" && previous) {
      return previous;
    }

    return reconcileEarnMachineOwner(previous, owner, entry.dashboardVariant);
  },
  (context, command) => {
    const state = context.get(earnMachineStateAtom);
    const intent =
      command.type === "machine/reconcile"
        ? command.intent
        : applyEarnAction({ action: command, intent: state.intent });

    context.setSelf({
      ...state,
      initializationConsumed:
        command.type === "machine/reconcile"
          ? state.initializationConsumed || command.consumeInitialization
          : true,
      intent,
    });
  }
).pipe(Atom.withLabel("earnMachineStateAtom"));

export const earnMachineIntentAtom = Atom.writable<
  EarnMachineIntent,
  EarnAction
>(
  (context) => context.get(earnMachineStateAtom).intent,
  (context, action) => context.set(earnMachineStateAtom, action)
).pipe(Atom.withLabel("earnMachineIntentAtom"));

export const earnMachineViewAtom = Atom.readable<EarnMachineView>((context) => {
  const entry = context.get(earnMachineEntryAtom);
  const previous = context.self<EarnMachineView>();
  const state = context.get(earnMachineStateAtom);
  const effectiveEntry = state.initializationConsumed
    ? { ...entry, initParams: null }
    : entry;

  if (effectiveEntry.walletResolution === "pending") {
    return makeResolvingWalletView({ intent: state.intent, previous });
  }

  const resolved = resolveEarnView({
    context,
    entry: effectiveEntry,
    intent: state.intent,
  });
  const reconciledIntent = reconcileEarnMachineView(state.intent, resolved);
  const consumeInitialization = shouldConsumeEarnInitialization({
    entry,
    view: resolved,
  });

  if (
    reconciledIntent !== state.intent ||
    (!state.initializationConsumed && consumeInitialization)
  ) {
    context.set(earnMachineStateAtom, {
      type: "machine/reconcile",
      consumeInitialization,
      intent: reconciledIntent,
    });
  }

  return resolveWalletMachineView({
    entry: effectiveEntry,
    previous,
    resolved,
  });
}).pipe(Atom.withLabel("earnMachineViewAtom"));

export const resolveWalletMachineView = ({
  entry,
  previous,
  resolved,
}: {
  readonly entry: EarnEntry;
  readonly previous: Option.Option<EarnMachineView>;
  readonly resolved: EarnMachineView;
}): EarnMachineView => {
  if (entry.walletResolution !== "pending") {
    return resolved;
  }

  const snapshot = previous.pipe(Option.getOrElse(() => resolved));

  return {
    ...snapshot,
    status: "resolving-wallet",
    failure: null,
    can: {
      selectToken: false,
      selectYield: false,
      selectValidator: false,
      submit: false,
    },
  };
};
