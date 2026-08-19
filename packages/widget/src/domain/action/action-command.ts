import type BigNumber from "bignumber.js";
import { Array as EArray, Option, Result, Schema } from "effect";
import type { EarnBalance, EarnYieldWithProvider } from "../earn/models";
import type { ValidatorInput as ValidatorDto } from "../earn/validator";
import type { WalletAddress } from "../identity/identifiers";
import type { YieldBalanceType } from "../portfolio/positions";
import type { Token } from "../token/token";
import { tokenString } from "../token/token";
import type { AdditionalAddresses } from "../wallet/address";
import type { ManageActionCommand, PendingAction } from "./models";
import {
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
  type YieldPendingActionType,
} from "./pending-action";

export const PendingActionStateKey = Schema.NonEmptyString.pipe(
  Schema.brand("PendingActionStateKey")
);
export type PendingActionStateKey = typeof PendingActionStateKey.Type;

const makePendingActionStateKey = Schema.decodeSync(PendingActionStateKey);

type PendingActionBalance = {
  amount: BigNumber;
  token: Token;
  type: EarnBalance["type"];
};

type PreparedPendingAction = {
  command: ManageActionCommand;
  integrationData: EarnYieldWithProvider;
  gasFeeToken: EarnYieldWithProvider["token"];
};

export const getPendingActionStateKey = ({
  actionType,
  balanceType,
  passthrough,
  token,
}: {
  balanceType: YieldBalanceType;
  token: Token;
  actionType: YieldPendingActionType;
  passthrough: string;
}): PendingActionStateKey =>
  makePendingActionStateKey(
    `${balanceType}-${tokenString(token)}-${actionType}-${passthrough}`
  );

export const preparePendingActionCommand = ({
  pendingActionsState,
  additionalAddresses,
  address,
  pendingAction,
  integration,
  yieldBalance,
  selectedValidators,
}: {
  pendingActionsState: ReadonlyMap<PendingActionStateKey, BigNumber>;
  address: WalletAddress | null;
  additionalAddresses: AdditionalAddresses | null;
  pendingAction: PendingAction;
  yieldBalance: PendingActionBalance;
  integration: EarnYieldWithProvider;
  selectedValidators: ValidatorDto["address"][];
}): Result.Result<PreparedPendingAction, Error> => {
  if (!address) return Result.fail(new Error("missing address"));

  const selectedValidator = EArray.head(selectedValidators).pipe(
    Option.getOrUndefined
  );
  const validatorAddressesRequired =
    isPendingActionValidatorAddressesRequired(pendingAction);
  const validatorAddressRequired =
    isPendingActionValidatorAddressRequired(pendingAction);
  if (validatorAddressesRequired && selectedValidators.length === 0) {
    return Result.fail(new Error("missing required validator addresses"));
  }
  if (validatorAddressRequired && !selectedValidator) {
    return Result.fail(new Error("missing required validator address"));
  }

  const resolveValidatorArgs = () => {
    if (validatorAddressesRequired) {
      return { validatorAddresses: selectedValidators };
    }
    if (validatorAddressRequired && selectedValidator) {
      return { validatorAddress: selectedValidator };
    }
    return {};
  };
  const validatorArgs = resolveValidatorArgs();
  const stateAmount = isPendingActionAmountRequired(pendingAction)
    ? pendingActionsState.get(
        getPendingActionStateKey({
          balanceType: yieldBalance.type,
          token: yieldBalance.token,
          actionType: pendingAction.type as YieldPendingActionType,
          passthrough: pendingAction.passthrough,
        })
      )
    : null;
  const args = {
    amount: stateAmount?.toString() ?? yieldBalance.amount.toFixed(),
    ...validatorArgs,
  } satisfies NonNullable<ManageActionCommand["arguments"]>;

  return Result.succeed({
    command: {
      action: pendingAction.type as YieldPendingActionType,
      address,
      arguments: { ...args, ...(additionalAddresses ?? {}) },
      passthrough: pendingAction.passthrough,
      yieldId: integration.id,
    },
    gasFeeToken: integration.mechanics.gasFeeToken,
    integrationData: integration,
  });
};
