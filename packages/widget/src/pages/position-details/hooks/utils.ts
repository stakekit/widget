import type {
  PendingActionDto as LegacyPendingActionDto,
  YieldBalanceDto as LegacyYieldBalanceDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { Either } from "purify-ts";
import { List, Maybe } from "purify-ts";
import {
  type AnyPendingActionDto,
  isPendingActionAmountRequired,
  isPendingActionValidatorAddressesRequired,
  isPendingActionValidatorAddressRequired,
} from "../../../domain/types/pending-action";
import type { SKWallet } from "../../../domain/types/wallet";
import { withAdditionalAddresses } from "../../../providers/yield-api-client-provider/request-helpers";
import type {
  YieldBalanceDto,
  YieldCreateManageActionDto,
  YieldTokenDto,
} from "../../../providers/yield-api-client-provider/types";
import type { State } from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";

type AnyYieldBalanceDto = {
  amount: string;
  token: YieldTokenDto;
  type: LegacyYieldBalanceDto["type"] | YieldBalanceDto["type"];
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
  integration: YieldDto;
  selectedValidators: ValidatorDto["address"][];
}): Either<
  Error,
  {
    requestDto: YieldCreateManageActionDto;
    integrationData: YieldDto;
    gasFeeToken: YieldDto["token"];
    address: NonNullable<SKWallet["address"]>;
    additionalAddresses:
      | NonNullable<SKWallet["additionalAddresses"]>
      | undefined;
  }
> =>
  Maybe.fromNullable(address)
    .toEither(new Error("missing address"))
    .map((val) => {
      const args: NonNullable<YieldCreateManageActionDto["arguments"]> = {
        amount: Maybe.fromPredicate(
          Boolean,
          isPendingActionAmountRequired(pendingActionDto)
        )
          .chainNullable(() =>
            pendingActionsState.get(
              getBalanceTokenActionType({
                balanceType: yieldBalance.type as YieldBalanceDto["type"],
                token: yieldBalance.token,
                actionType:
                  pendingActionDto.type as LegacyPendingActionDto["type"],
              })
            )
          )
          .map((v) => v.toString())
          .alt(Maybe.of(yieldBalance.amount))
          .extract(),
      };

      if (selectedValidators.length) {
        if (isPendingActionValidatorAddressesRequired(pendingActionDto)) {
          args.validatorAddresses = selectedValidators;
        } else if (isPendingActionValidatorAddressRequired(pendingActionDto)) {
          args.validatorAddress = List.head(selectedValidators).orDefault("");
        }
      }

      return {
        requestDto: {
          action: pendingActionDto.type as LegacyPendingActionDto["type"],
          address: val,
          arguments: withAdditionalAddresses({
            additionalAddresses,
            argumentsDto: args,
          }),
          passthrough: pendingActionDto.passthrough,
          yieldId: integration.id,
        },
        address: val,
        additionalAddresses: additionalAddresses ?? undefined,
        gasFeeToken: integration.metadata.gasFeeToken,
        integrationData: integration,
      };
    });
