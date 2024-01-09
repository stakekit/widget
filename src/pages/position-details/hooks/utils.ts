import {
  PendingActionDto,
  PendingActionRequestDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { Either, List, Maybe } from "purify-ts";
import { SKWallet } from "../../../domain/types";

export const preparePendingActionRequestDto = ({
  additionalAddresses,
  address,
  pendingActionDto,
  integration,
  yieldBalance,
  selectedValidators,
}: {
  address: SKWallet["address"];
  additionalAddresses: SKWallet["additionalAddresses"];
  pendingActionDto: PendingActionDto;
  yieldBalance: YieldBalanceDto;
  integration: YieldDto;
  selectedValidators: ValidatorDto["address"][];
}): Either<
  Error,
  PendingActionRequestDto & {
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
        amount: yieldBalance.amount,
      };

      if (selectedValidators.length) {
        if (pendingActionDto.args?.args?.validatorAddresses?.required) {
          args.validatorAddresses = selectedValidators;
        } else if (pendingActionDto.args?.args?.validatorAddress?.required) {
          args.validatorAddress = List.head(selectedValidators).orDefault("");
        }
      }

      return {
        address: val,
        additionalAddresses: additionalAddresses ?? undefined,
        gasFeeToken: integration.metadata.gasFeeToken,
        args,
        integrationId: integration.id,
        passthrough: pendingActionDto.passthrough,
        type: pendingActionDto.type,
      };
    });
