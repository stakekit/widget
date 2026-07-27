import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/config/settings";
import { walletScopeOwnerKey } from "../../../../../services/wallet/domain/scope";
import { initParamsAtom } from "../../../../init-params/state";
import {
  selectCurrentWalletAtom,
  walletScopeAtom,
} from "../../../../wallet/state";
import { resolveEarnView } from "../resolver/view";
import { makeResolvingWalletView } from "../resolver/view-model";
import type { EarnEntry, EarnMachineIntent, EarnMachineView } from "../types";
import type { EarnAction } from "./actions";
import { type EarnMachineState, reconcileEarnMachineOwner } from "./owner";
import { applyEarnAction } from "./reducer";

const earnWalletStateAtom = selectCurrentWalletAtom((state) => state);

export const earnMachineEntryAtom = Atom.make<EarnEntry>((context) => {
  const config = context.get(widgetConfigAtom);
  const wallet = context.get(earnWalletStateAtom);
  const walletScope = context.get(walletScopeAtom);
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

const earnMachineStateAtom = Atom.writable<EarnMachineState, EarnAction>(
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
  (context, action) => {
    const state = context.get(earnMachineStateAtom);
    const intent = applyEarnAction({ action, intent: state.intent });

    if (intent === state.intent && state.userSelected) {
      return;
    }

    context.setSelf({ ...state, intent, userSelected: true });
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
  const state = context.get(earnMachineStateAtom);

  if (entry.walletResolution === "pending") {
    return makeResolvingWalletView({
      intent: state.intent,
      previous: context.self<EarnMachineView>(),
    });
  }

  return resolveEarnView({
    context,
    entry: state.userSelected ? { ...entry, initParams: null } : entry,
    intent: state.intent,
  });
}).pipe(Atom.withLabel("earnMachineViewAtom"));
