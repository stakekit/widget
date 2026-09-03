import * as Atom from "effect/unstable/reactivity/Atom";
import { exactDecimal } from "../../../domain/finance/exact";
import { tokenString } from "../../../domain/token/token";
import { type EarnSelection, earnSelectionViewAtom } from "./earn-selection";

export const earnPageSearchAtom = Atom.make({
  stake: "",
  token: "",
}).pipe(Atom.withLabel("earnPageSearchAtom"));

export const getEarnPageValidationKey = (selection: EarnSelection): string =>
  JSON.stringify([
    selection.category,
    selection.yield?.id ?? null,
    selection.token ? tokenString(selection.token.token) : null,
  ]);

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
    stakeAmount: exactDecimal(view.form.stakeAmount),
  };
}).pipe(Atom.withLabel("earnPageQuoteAtom"));
