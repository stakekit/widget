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

type EarnValidationInput = {
  readonly connected: boolean;
  readonly hasTronResource: boolean;
  readonly stakeAmountGreaterThanAvailableAmount: boolean;
  readonly stakeAmountGreaterThanMax: boolean;
  readonly stakeAmountIsZero: boolean;
  readonly stakeAmountLessThanMin: boolean;
  readonly submitted: boolean;
  readonly tronResourceRequired: boolean;
};

export const getEarnPageValidation = (input: EarnValidationInput) => {
  const errors = {
    stakeAmountGreaterThanAvailableAmount: false,
    stakeAmountGreaterThanMax: false,
    stakeAmountIsZero: false,
    stakeAmountLessThanMin: false,
    tronResource: false,
  };

  if (!input.connected) {
    return { errors, hasErrors: false, submitted: false };
  }

  const connectedErrors = {
    stakeAmountGreaterThanAvailableAmount:
      input.stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax: input.stakeAmountGreaterThanMax,
    stakeAmountIsZero: input.stakeAmountIsZero,
    stakeAmountLessThanMin: input.stakeAmountLessThanMin,
    tronResource: input.tronResourceRequired && !input.hasTronResource,
  };

  return {
    errors: connectedErrors,
    hasErrors: Object.values(connectedErrors).some(Boolean),
    submitted: input.submitted,
  };
};
