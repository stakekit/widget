import type BigNumber from "bignumber.js";
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
  minimum: BigNumber | null;
  maximum: BigNumber | null;
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

  const minimum = amountArg.minimum;
  const maximum = amountArg.maximum;

  return {
    required: !!amountArg.required,
    minimum,
    maximum,
    forceMax:
      minimum?.isEqualTo(-1) === true && maximum?.isEqualTo(-1) === true,
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
