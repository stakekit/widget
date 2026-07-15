import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/config";
import { initParamsAtom } from "../../../../init-params";
import { selectCurrentWalletAtom } from "../../../../wallet";
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
  const initParams = context.get(initParamsAtom);
  const connected = wallet.status === "connected";

  return {
    address: connected ? wallet.address : null,
    additionalAddresses: connected ? wallet.additionalAddresses : null,
    categoryOrder: config.dashboardYieldCategoryOrder,
    dashboardVariant:
      !!config.dashboardVariant && config.yieldGrouping === "category",
    initParams,
    network: connected ? wallet.network : null,
    preferredTokenYieldsPerNetwork:
      config.preferredTokenYieldsPerNetwork ?? null,
    tokensForEnabledYieldsOnly: !!config.tokensForEnabledYieldsOnly,
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

export const earnMachineViewAtom = Atom.readable<EarnMachineView>((context) =>
  resolveEarnView({
    context,
    entry: context.get(earnMachineEntryAtom),
    intent: context.get(earnMachineIntentAtom),
  })
).pipe(Atom.withLabel("earnMachineViewAtom"));
