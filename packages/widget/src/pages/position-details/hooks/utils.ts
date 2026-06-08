import type { Either } from "purify-ts";
import { List, Maybe } from "purify-ts";
import type { YieldCreateManageActionDto } from "../../../domain/types/action";
import {
  type AnyPendingActionDto,
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
  type YieldPendingActionType,
} from "../../../domain/types/pending-action";
import type { YieldBalanceDto } from "../../../domain/types/positions";
import type { YieldTokenDto } from "../../../domain/types/tokens";
import type { SKWallet } from "../../../domain/types/wallet";
import type { Yield } from "../../../domain/types/yields";
import type { ValidatorDto } from "../../../generated/api/yield";
import type { State } from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";

type AnyYieldBalanceDto = {
  amount: string;
  token: YieldTokenDto;
  type: YieldBalanceDto["type"];
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
  integration: Yield;
  selectedValidators: ValidatorDto["address"][];
}): Either<
  Error,
  {
    requestDto: YieldCreateManageActionDto;
    integrationData: Yield;
    gasFeeToken: Yield["token"];
    address: NonNullable<SKWallet["address"]>;
    additionalAddresses:
      | NonNullable<SKWallet["additionalAddresses"]>
      | undefined;
  }
> =>
  Maybe.fromNullable(address)
    .toEither(new Error("missing address"))
    .map((val) => {
      const validatorArgs =
        selectedValidators.length &&
        isPendingActionValidatorAddressesRequired(pendingActionDto)
          ? { validatorAddresses: selectedValidators }
          : selectedValidators.length &&
              isPendingActionValidatorAddressRequired(pendingActionDto)
            ? { validatorAddress: List.head(selectedValidators).orDefault("") }
            : {};

      const args = {
        amount: Maybe.fromPredicate(
          Boolean,
          isPendingActionAmountRequired(pendingActionDto)
        )
          .chainNullable(() =>
            pendingActionsState.get(
              getBalanceTokenActionType({
                balanceType: yieldBalance.type as YieldBalanceDto["type"],
                token: yieldBalance.token,
                actionType: pendingActionDto.type as YieldPendingActionType,
              })
            )
          )
          .map((v) => v.toString())
          .alt(Maybe.of(yieldBalance.amount))
          .extract(),
        ...validatorArgs,
      } satisfies NonNullable<YieldCreateManageActionDto["arguments"]>;

      return {
        requestDto: {
          action: pendingActionDto.type as YieldPendingActionType,
          address: val,
          arguments: {
            ...args,
            ...(additionalAddresses ?? {}),
          },
          passthrough: pendingActionDto.passthrough,
          yieldId: integration.id,
        },
        address: val,
        additionalAddresses: additionalAddresses ?? undefined,
        gasFeeToken: integration.mechanics.gasFeeToken,
        integrationData: integration,
      };
    });
