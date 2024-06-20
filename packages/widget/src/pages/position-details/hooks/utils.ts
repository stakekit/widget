import type {
  PendingActionDto,
  PendingActionRequestDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { Either } from "purify-ts";
import { List, Maybe } from "purify-ts";
import type { SKWallet } from "../../../domain/types";
import type { State } from "../state/types";
import { getBalanceTokenActionType } from "../state/utils";

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
  pendingActionDto: PendingActionDto;
  yieldBalance: YieldBalanceDto;
  integration: YieldDto;
  selectedValidators: ValidatorDto["address"][];
}): Either<
  Error,
  {
    requestDto: PendingActionRequestDto;
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
      const args: PendingActionRequestDto["args"] = {
        amount: Maybe.fromPredicate(
          Boolean,
          pendingActionDto.args?.args?.amount?.required
        )
          .chainNullable(() =>
            pendingActionsState.get(
              getBalanceTokenActionType({
                balanceType: yieldBalance.type,
                token: yieldBalance.token,
                actionType: pendingActionDto.type,
              })
            )
          )
          .map((v) => v.toString())
          .alt(Maybe.of(yieldBalance.amount))
          .extract(),
      };

      if (selectedValidators.length) {
        if (pendingActionDto.args?.args?.validatorAddresses?.required) {
          args.validatorAddresses = selectedValidators;
        } else if (pendingActionDto.args?.args?.validatorAddress?.required) {
          args.validatorAddress = List.head(selectedValidators).orDefault("");
        }
      }

      return {
        requestDto: {
          args,
          integrationId: integration.id,
          passthrough: pendingActionDto.passthrough,
          type: pendingActionDto.type,
        },
        address: val,
        additionalAddresses: additionalAddresses ?? undefined,
        gasFeeToken: integration.metadata.gasFeeToken,
        integrationData: integration,
      };
    });
