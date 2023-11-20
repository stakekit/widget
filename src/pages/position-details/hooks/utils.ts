import {
  PendingActionDto,
  PendingActionRequestDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { Either, Maybe } from "purify-ts";
import { SKWallet } from "../../../domain/types";

export const preparePendingActionRequestDto = ({
  additionalAddresses,
  address,
  pendingActionDto,
  integration,
  yieldBalance,
}: {
  address: SKWallet["address"];
  additionalAddresses: SKWallet["additionalAddresses"];
  pendingActionDto: PendingActionDto;
  yieldBalance: YieldBalanceDto;
  integration: YieldDto;
}): Either<
  Error,
  PendingActionRequestDto & {
    gasFeeToken: YieldDto["token"];
    address: NonNullable<SKWallet["address"]>;
    additionalAddresses:
      | NonNullable<SKWallet["additionalAddresses"]>
      | undefined;
  }
> => {
  return Maybe.fromNullable(address)
    .toEither(new Error("missing address"))
    .map((val) => ({
      address: val,
      additionalAddresses: additionalAddresses ?? undefined,
      gasFeeToken: integration.metadata.gasFeeToken,
      args: {
        validatorAddress: yieldBalance.validatorAddress,
        amount: yieldBalance.amount,
      },
      integrationId: integration.id,
      passthrough: pendingActionDto.passthrough,
      type: pendingActionDto.type,
    }));
};
