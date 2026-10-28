import type BigNumber from "bignumber.js";
import { Schema } from "effect";
import type { YieldBalanceType } from "../portfolio/positions";
import { ManageActionCommand, PendingAction } from "./models";

export const YieldPendingActionType = Schema.Union([
  PendingAction.fields.type,
  ManageActionCommand.fields.action,
]);
export type YieldPendingActionType = typeof YieldPendingActionType.Type;

/**
 * Pending actions a position never needs: cancelling a queued request, or
 * merging stake accounts.
 */
export const isOptionalPendingAction = (type: YieldPendingActionType) =>
  type === "CANCEL_PENDING" || type === "MERGE";

/**
 * i18n context naming what a pending action acts on when its type alone is
 * ambiguous: CANCEL_PENDING cancels a deposit on an entering balance and a
 * withdrawal on an exiting one. A confidential vault's WITHDRAW on a
 * withdrawable balance completes an instant withdrawal its unwrap began.
 */
export type PendingActionLabelContext =
  | "deposit"
  | "instant_withdrawal"
  | "withdrawal";

export const getPendingActionLabelContext = (
  type: YieldPendingActionType,
  balanceType: YieldBalanceType,
  { confidential = false }: { readonly confidential?: boolean } = {}
): PendingActionLabelContext | undefined => {
  if (confidential && type === "WITHDRAW" && balanceType === "withdrawable") {
    return "instant_withdrawal";
  }
  if (type !== "CANCEL_PENDING") return undefined;
  if (balanceType === "entering") return "deposit";
  if (balanceType === "exiting") return "withdrawal";
  return undefined;
};

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
