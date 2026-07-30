import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { IntegrationId, MarketId, TokenAddress, WalletAddress } from "../ids";

export const ActionCommand = Schema.Struct({
  ...BorrowApi.ActionRequestDto.fields,
  integrationId: IntegrationId,
  address: WalletAddress,
  args: Schema.Struct({
    ...BorrowApi.ActionRequestDto.fields.args.fields,
    marketId: MarketId,
    tokenAddress: Schema.optionalKey(TokenAddress),
    collateralTokenAddress: Schema.optionalKey(TokenAddress),
  }),
});
export type ActionCommand = typeof ActionCommand.Type;
