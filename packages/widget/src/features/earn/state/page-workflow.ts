import { Equal } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { tokenString } from "../../../domain/token/token";
import { fromAmountValue } from "../../../shared/lib/amount-value";
import { compositeKey } from "../../../shared/lib/composite-key";
import { type EarnSelection, earnSelectionViewAtom } from "./earn-selection";

export const earnPageSearchAtom = Atom.make({
  stake: "",
  token: "",
}).pipe(Atom.withLabel("earnPageSearchAtom"));

export const getEarnPageValidationKey = (selection: EarnSelection): string =>
  compositeKey([
    selection.category,
    selection.yield?.id ?? null,
    selection.token ? tokenString(selection.token.token) : null,
  ]);

export const earnPageInputAtom = Atom.make(
  (context) => context.get(earnSelectionViewAtom).form
).pipe(Atom.withLabel("earnPageInputAtom"));

export const earnPageSelectionAtom = Atom.make(
  (context) => context.get(earnSelectionViewAtom).selection
).pipe(
  // Each amount typed rebuilds an equal selection; its readers keep the last.
  Atom.withEquality(Equal.equals),
  Atom.withLabel("earnPageSelectionAtom")
);

export const earnPageQuoteAtom = Atom.make((context) => {
  const view = context.get(earnSelectionViewAtom);

  return {
    selectedProviderOption: view.form.providerOption,
    selectedStake: view.selection.yield,
    selectedToken: view.selection.token?.token ?? null,
    selectedValidators: view.selection.validators,
    stakeAmount: fromAmountValue(view.form.stakeAmount),
  };
}).pipe(Atom.withLabel("earnPageQuoteAtom"));
