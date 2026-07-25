import BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "./atoms-state/machine/atoms";
import type { EarnMachineIntent } from "./atoms-state/types";

export const earnPageSearchAtom = Atom.make({
  stake: "",
  token: "",
  validator: "",
}).pipe(Atom.keepAlive, Atom.withLabel("earnPageSearchAtom"));

const getEarnPageSubmissionKey = (intent: EarnMachineIntent) =>
  JSON.stringify([
    intent.selectedCategory,
    intent.selectedYieldId,
    intent.selectedTokenKey,
  ]);

const submittedEarnPageSelectionKeyAtom = Atom.make<string | null>(null);

export const earnPageSubmittedAtom = Atom.writable<boolean, boolean>(
  (context) =>
    context.get(submittedEarnPageSelectionKeyAtom) ===
    getEarnPageSubmissionKey(context.get(earnMachineIntentAtom)),
  (context, submitted) =>
    context.set(
      submittedEarnPageSelectionKeyAtom,
      submitted
        ? getEarnPageSubmissionKey(context.get(earnMachineIntentAtom))
        : null
    )
).pipe(Atom.keepAlive, Atom.withLabel("earnPageSubmittedAtom"));

export const earnPageInputAtom = Atom.make(
  (context) => context.get(earnMachineViewAtom).form
).pipe(Atom.withLabel("earnPageInputAtom"));

export const earnPageSelectionAtom = Atom.make(
  (context) => context.get(earnMachineViewAtom).selection
).pipe(Atom.withLabel("earnPageSelectionAtom"));

export const earnPageQuoteAtom = Atom.make((context) => {
  const view = context.get(earnMachineViewAtom);

  return {
    selectedProviderYieldId: view.form.providerYieldId,
    selectedStake: view.selection.yield,
    selectedToken: view.selection.token?.token ?? null,
    selectedValidators: view.selection.validators,
    stakeAmount: new BigNumber(view.form.stakeAmount),
  };
}).pipe(Atom.withLabel("earnPageQuoteAtom"));
