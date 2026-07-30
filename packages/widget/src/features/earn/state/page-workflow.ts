import BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import { tokenString } from "../../../domain/types/tokens";
import { type EarnSelection, earnSelectionViewAtom } from "./earn-selection";

export const earnPageSearchAtom = Atom.make({
  stake: "",
  token: "",
}).pipe(Atom.keepAlive, Atom.withLabel("earnPageSearchAtom"));

const getEarnPageSubmissionKey = (selection: EarnSelection): string =>
  JSON.stringify([
    selection.category,
    selection.yield?.id ?? null,
    selection.token ? tokenString(selection.token.token) : null,
  ]);

const submittedEarnPageSelectionKeyAtom = Atom.make<string | null>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("submittedEarnPageSelectionKeyAtom")
);

export const earnPageSubmittedAtom = Atom.writable<boolean, boolean>(
  (context) =>
    context.get(submittedEarnPageSelectionKeyAtom) ===
    getEarnPageSubmissionKey(context.get(earnSelectionViewAtom).selection),
  (context, submitted) =>
    context.set(
      submittedEarnPageSelectionKeyAtom,
      submitted
        ? getEarnPageSubmissionKey(context.get(earnSelectionViewAtom).selection)
        : null
    )
).pipe(Atom.withLabel("earnPageSubmittedAtom"));

export const earnPageInputAtom = Atom.make(
  (context) => context.get(earnSelectionViewAtom).form
).pipe(Atom.withLabel("earnPageInputAtom"));

export const earnPageSelectionAtom = Atom.make(
  (context) => context.get(earnSelectionViewAtom).selection
).pipe(Atom.withLabel("earnPageSelectionAtom"));

export const earnPageQuoteAtom = Atom.make((context) => {
  const view = context.get(earnSelectionViewAtom);

  return {
    selectedProviderYieldId: view.form.providerYieldId,
    selectedStake: view.selection.yield,
    selectedToken: view.selection.token?.token ?? null,
    selectedValidators: view.selection.validators,
    stakeAmount: new BigNumber(view.form.stakeAmount),
  };
}).pipe(Atom.withLabel("earnPageQuoteAtom"));
