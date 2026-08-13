import type { ManageActionCommand, PendingAction } from "./models";

export type YieldPendingActionType =
  | PendingAction["type"]
  | NonNullable<ManageActionCommand["action"]>;

type PendingActionArgName =
  | "amount"
  | "validatorAddress"
  | "validatorAddresses";

type PendingActionAmountConfig = {
  required: boolean;
  minimum: number | null;
  maximum: number | null;
  forceMax: boolean;
};

export const isPendingActionAmountRequired = (pendingAction: PendingAction) =>
  !!getPendingActionAmountConfig(pendingAction)?.required;

export const isPendingActionValidatorAddressRequired = (
  pendingAction: PendingAction
) => !!getPendingActionArgument(pendingAction, "validatorAddress")?.required;

export const isPendingActionValidatorAddressesRequired = (
  pendingAction: PendingAction
) => !!getPendingActionArgument(pendingAction, "validatorAddresses")?.required;

export const getPendingActionAmountConfig = (
  pendingAction: PendingAction
): PendingActionAmountConfig | null => {
  const amountArg = getPendingActionArgument(pendingAction, "amount");

  if (!amountArg) {
    return null;
  }

  const minimum = toNumberOrNull(amountArg.minimum);
  const maximum = toNumberOrNull(amountArg.maximum);

  return {
    required: !!amountArg.required,
    minimum,
    maximum,
    forceMax: minimum === -1 && maximum === -1,
  };
};

const getPendingActionArgument = (
  pendingAction: PendingAction,
  name: PendingActionArgName
) => {
  const v2Field = pendingAction.arguments?.fields?.find(
    (field) => field.name === name
  );

  if (v2Field) {
    return {
      required: !!v2Field.required,
      minimum: v2Field.minimum ?? null,
      maximum: v2Field.maximum ?? null,
    };
  }

  return null;
};

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
