import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/config/settings";
import { initParamsAtom } from "../../../../init-params/atoms";
import {
  currentWalletScopeAtom,
  selectCurrentWalletAtom,
} from "../../../../wallet/state/selectors";
import { resolveEarnView } from "../resolver/view";
import {
  type EarnEntry,
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../types";
import type { EarnAction } from "./actions";
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

export const earnMachineIntentAtom = Atom.writable<
  EarnMachineIntent,
  EarnAction
>(
  (context) =>
    context
      .self<EarnMachineIntent>()
      .pipe(Option.getOrElse(makeDefaultEarnIntent)),
  (context, action) => {
    const intent = context.get(earnMachineIntentAtom);
    const newIntent = applyEarnAction({ action, intent });

    context.setSelf(newIntent);
  }
).pipe(Atom.withLabel("earnMachineIntentAtom"));

export const earnMachineViewAtom = Atom.readable<EarnMachineView>((context) => {
  const entry = context.get(earnMachineEntryAtom);
  const previous = context.self<EarnMachineView>();

  if (entry.walletResolution === "pending" && Option.isSome(previous)) {
    return previous.value;
  }

  return resolveEarnView({
    context,
    entry,
    intent: context.get(earnMachineIntentAtom),
  });
}).pipe(Atom.withLabel("earnMachineViewAtom"));
