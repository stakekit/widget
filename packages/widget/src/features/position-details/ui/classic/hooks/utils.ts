import type BigNumber from "bignumber.js";
import { Array as EArray, Option, Result } from "effect";
import type { ManageActionCommand } from "../../../../../domain/schema/action-models";
import type {
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import type { AppToken } from "../../../../../domain/schema/legacy-models";

import {
  type AnyPendingActionDto,
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
  type YieldPendingActionType,
} from "../../../../../domain/types/pending-action";

import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import type { SKWallet } from "../../../../../domain/types/wallet";

import type { PositionDetailsWorkflowState as State } from "../../../state/workflow";
import { getBalanceTokenActionType } from "../state/utils";

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

export const preparePendingActionRequestDto = ({
  pendingActionsState,
  additionalAddresses,
  address,
  pendingActionDto,
  integration,
  yieldBalance,
  selectedValidators,
}: {
  pendingActionsState: State["pendingActions"];
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
  const validatorArgs =
    selectedValidators.length > 0 &&
    isPendingActionValidatorAddressesRequired(pendingActionDto)
      ? { validatorAddresses: selectedValidators }
      : selectedValidator &&
          isPendingActionValidatorAddressRequired(pendingActionDto)
        ? {
            validatorAddress: selectedValidator,
          }
        : {};
  const stateAmount = isPendingActionAmountRequired(pendingActionDto)
    ? pendingActionsState.get(
        getBalanceTokenActionType({
          balanceType: yieldBalance.type,
          token: yieldBalance.token,
          actionType: pendingActionDto.type as YieldPendingActionType,
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
