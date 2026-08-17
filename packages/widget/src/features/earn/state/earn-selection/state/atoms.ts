import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../../app/runtime/widget-config";
import {
  sameWalletScopeOwner,
  type WalletScopeOwnerKey,
  walletScopeFromState,
  walletScopeOwnerKey,
} from "../../../../../services/wallet/wallet-scope";
import { disconnectedNormalizedWalletState } from "../../../../../services/wallet/wallet-state";
import { initParamsAtom } from "../../../../init-params/state";
import { walletStateResultAtom } from "../../../../wallet/state";
import { makeResolvingWalletView } from "../model/view-model";
import type { EarnEntry, EarnEntryIntent, EarnSelectionView } from "../types";
import {
  type EarnEntryState,
  reconcileEarnEntryOwner,
  resetEarnEntryIntent,
} from "./owner";
import { resolveEarnViewFromResources } from "./resource-observations";

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

export const earnEntryAtom = Atom.make<EarnEntry>((context) => {
  const config = context.get(widgetConfigAtom);
  const wallet = context.get(earnWalletSnapshotAtom);

  return {
    categoryOrder: config.dashboardYieldCategoryOrder,
    dashboardVariant:
      config.dashboardVariant && config.yieldGrouping === "category",
    initParams: context.get(initParamsAtom),
    preferredTokenYieldsPerNetwork: config.preferredTokenYieldsPerNetwork,
    walletScope: wallet.walletScope,
    walletResolution: wallet.walletResolution,
  };
}).pipe(Atom.withLabel("earnEntryAtom"));

const earnEntryStateAtom = Atom.writable<EarnEntryState, EarnEntryState>(
  (context) => {
    const entry = context.get(earnEntryAtom);
    const owner = entry.walletScope
      ? walletScopeOwnerKey(entry.walletScope)
      : null;
    const previous = context.self<EarnEntryState>().pipe(Option.getOrNull);
    return reconcileEarnEntryOwner(
      previous,
      owner,
      entry.dashboardVariant,
      entry.walletResolution,
      entry.initParams ?? null
    );
  },
  (context, state) => context.setSelf(state)
).pipe(Atom.keepAlive, Atom.withLabel("earnEntryStateAtom"));

type EarnSelectionProjection = {
  readonly state: EarnEntryState;
  readonly view: EarnSelectionView;
};

const hasSameOwner = (
  first: WalletScopeOwnerKey | null,
  second: WalletScopeOwnerKey | null
) => (first && second ? sameWalletScopeOwner(first, second) : first === second);

const earnSelectionProjectionAtom = Atom.readable<EarnSelectionProjection>(
  (context) => {
    const state = context.get(earnEntryStateAtom);
    const previousProjection = context
      .self<EarnSelectionProjection>()
      .pipe(Option.getOrNull);
    const entry: EarnEntry = {
      ...context.get(earnEntryAtom),
      initParams: state.initParams,
    };
    const previousView =
      previousProjection &&
      hasSameOwner(previousProjection.state.owner, state.owner)
        ? previousProjection.view
        : null;
    const view =
      entry.walletResolution === "pending"
        ? makeResolvingWalletView({
            intent: state.intent,
            previous: Option.fromNullishOr(previousView),
          })
        : resolveEarnViewFromResources(context, {
            entry,
            intent: state.intent,
            previous: previousView,
          });

    return { state, view };
  }
).pipe(Atom.withLabel("earnSelectionProjectionAtom"));

export const earnEntryIntentAtom = Atom.writable<
  EarnEntryIntent,
  EarnEntryIntent
>(
  (context) => context.get(earnSelectionProjectionAtom).state.intent,
  (context, intent) => {
    const state = context.get(earnSelectionProjectionAtom).state;
    context.set(earnEntryStateAtom, {
      ...state,
      initializationPhase: "complete",
      initParams: null,
      intent,
    });
  }
).pipe(Atom.withLabel("earnEntryIntentAtom"));

export const resetEarnEntryIntentForOwnerAtom = Atom.fnSync(
  (owner: WalletScopeOwnerKey, context) => {
    const state = context(earnEntryStateAtom);
    if (!state.owner || !sameWalletScopeOwner(state.owner, owner)) return;

    const reset = resetEarnEntryIntent(state);
    if (reset === state) return;

    context.set(earnEntryStateAtom, reset);
  }
).pipe(Atom.withLabel("resetEarnEntryIntentForOwnerAtom"));

export const earnSelectionViewAtom = Atom.make(
  (context) => context.get(earnSelectionProjectionAtom).view
).pipe(Atom.withLabel("earnSelectionViewAtom"));
