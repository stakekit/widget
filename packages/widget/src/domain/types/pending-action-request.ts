import type BigNumber from "bignumber.js";
import { Array as EArray, Option, Result } from "effect";
import type { ManageActionCommand } from "../schema/action-models";
import type { EarnBalance, EarnYieldWithProvider } from "../schema/earn-models";
import type { AppToken } from "../schema/legacy-models";
import {
  type AnyPendingActionDto,
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
  type YieldPendingActionType,
} from "./pending-action";
import type { YieldBalanceType } from "./positions";
import { type TokenString, tokenString } from "./tokens";
import type { ValidatorInput as ValidatorDto } from "./validators";
import type { SKWallet } from "./wallet";

export type PendingActionStateKey =
  `${YieldBalanceType}-${TokenString}-${YieldPendingActionType}-${string}`;

type AnyYieldBalanceDto = {
  amount: BigNumber;
  token: AppToken;
  type: EarnBalance["type"];
};

type PreparedPendingAction = {
  requestDto: ManageActionCommand;
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
  token: AppToken;
  actionType: YieldPendingActionType;
  passthrough: string;
}): PendingActionStateKey =>
  `${balanceType}-${tokenString(token)}-${actionType}-${passthrough}`;

export const preparePendingActionRequestDto = ({
  pendingActionsState,
  additionalAddresses,
  address,
  pendingActionDto,
  integration,
  yieldBalance,
  selectedValidators,
}: {
  pendingActionsState: ReadonlyMap<PendingActionStateKey, BigNumber>;
  address: SKWallet["address"];
  additionalAddresses: SKWallet["additionalAddresses"];
  pendingActionDto: AnyPendingActionDto;
  yieldBalance: AnyYieldBalanceDto;
  integration: EarnYieldWithProvider;
  selectedValidators: ValidatorDto["address"][];
}): Result.Result<PreparedPendingAction, Error> => {
  if (!address) return Result.fail(new Error("missing address"));

  const selectedValidator = EArray.head(selectedValidators).pipe(
    Option.getOrUndefined
  );
  const validatorAddressesRequired =
    isPendingActionValidatorAddressesRequired(pendingActionDto);
  const validatorAddressRequired =
    isPendingActionValidatorAddressRequired(pendingActionDto);
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
  const stateAmount = isPendingActionAmountRequired(pendingActionDto)
    ? pendingActionsState.get(
        getPendingActionStateKey({
          balanceType: yieldBalance.type,
          token: yieldBalance.token,
          actionType: pendingActionDto.type as YieldPendingActionType,
          passthrough: pendingActionDto.passthrough,
        })
      )
    : null;
  const args = {
    amount: stateAmount?.toString() ?? yieldBalance.amount.toFixed(),
    ...validatorArgs,
  } satisfies NonNullable<ManageActionCommand["arguments"]>;

  return Result.succeed({
    requestDto: {
      action: pendingActionDto.type as YieldPendingActionType,
      address,
      arguments: { ...args, ...(additionalAddresses ?? {}) },
      passthrough: pendingActionDto.passthrough,
      yieldId: integration.id,
    },
    gasFeeToken: integration.mechanics.gasFeeToken,
    integrationData: integration,
  });
};
