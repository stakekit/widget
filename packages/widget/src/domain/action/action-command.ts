import type BigNumber from "bignumber.js";
import { Array as EArray, Option, Result, Schema } from "effect";

import type {
  ManageActionCommand,
  PendingAction,
  YieldPendingActionType,
} from "../earn/action-models";
import type {
  BalanceShares,
  EarnBalance,
  YieldBalanceType,
} from "../earn/balance";
import { getPendingActionAmount, type TokenAmount } from "../earn/denomination";
import type { ValidatorInput as ValidatorDto } from "../earn/validator";
import type { EarnYieldWithProvider } from "../earn/yield-schema";
import { truncateToTokenDecimals } from "../finance/exact";
import type { WalletAddress } from "../identity/identifiers";
import { type Token, tokenString } from "../token/token";
import type { AdditionalAddresses } from "../wallet/address";
import {
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "./pending-action";

export const PendingActionStateKey = Schema.NonEmptyString.pipe(
  Schema.brand("PendingActionStateKey")
);
export type PendingActionStateKey = typeof PendingActionStateKey.Type;

const makePendingActionStateKey = Schema.decodeSync(PendingActionStateKey);

type PendingActionBalance = BalanceShares & {
  amount: BigNumber;
  shareToken?: Token;
  token: Token;
  type: EarnBalance["type"];
};

type PreparedPendingAction = {
  /** What the action shows: see `getPendingActionAmount`. */
  amount: TokenAmount | null;
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
  selectedValidators: ReadonlyArray<ValidatorDto["address"]>;
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
  // Only an action whose arguments take an amount is sent one; any other
  // carries its own in its passthrough, and the balance it sits on, such as
  // several stake accounts' withdrawals summed, would contradict it.
  const takesAmount = isPendingActionAmountRequired(pendingAction);
  const executableAmount = takesAmount
    ? truncateToTokenDecimals(
        pendingActionsState.get(
          getPendingActionStateKey({
            balanceType: yieldBalance.type,
            token: yieldBalance.token,
            actionType: pendingAction.type,
            passthrough: pendingAction.passthrough,
          })
        ) ?? yieldBalance.amount,
        yieldBalance.token.decimals
      )
    : null;
  if (executableAmount && !executableAmount.isGreaterThan(0)) {
    return Result.fail(new Error("amount below one base unit"));
  }
  const args = {
    ...(executableAmount ? { amount: executableAmount.toFixed() } : {}),
    ...validatorArgs,
  } satisfies NonNullable<ManageActionCommand["arguments"]>;

  return Result.succeed({
    // An amount the action takes is the one it acts on, entered or defaulted.
    amount: getPendingActionAmount({
      balance: yieldBalance,
      enteredAmount: executableAmount,
      pendingAction,
    }),
    command: {
      action: pendingAction.type,
      address,
      arguments: { ...args, ...additionalAddresses },
      passthrough: pendingAction.passthrough,
      yieldId: integration.id,
    },
    gasFeeToken: integration.mechanics.gasFeeToken,
    integrationData: integration,
  });
};
