import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import {
  ActionId,
  IntegrationId,
  MarketId,
  TokenAddress,
  WalletAddress,
} from "../ids";
import { Transaction } from "./transaction";

const ActionRawArguments = Schema.Struct({
  ...BorrowApi.ArgumentsDto.fields,
  marketId: MarketId,
  tokenAddress: Schema.optionalKey(TokenAddress),
  collateralTokenAddress: Schema.optionalKey(TokenAddress),
  amount: Schema.optionalKey(Schema.FiniteFromString),
  amountRaw: Schema.optionalKey(Schema.BigIntFromString),
  collateralAmount: Schema.optionalKey(Schema.FiniteFromString),
  collateralAmountRaw: Schema.optionalKey(Schema.BigIntFromString),
});

const ActionMetadata = Schema.Struct({
  currentHealthFactor: Schema.NullOr(Schema.FiniteFromString),
  predictedHealthFactor: Schema.NullOr(Schema.FiniteFromString),
  currentLtv: Schema.FiniteFromString,
  predictedLtv: Schema.FiniteFromString,
  liquidationThreshold: Schema.FiniteFromString,
  predictedTotalSupplyUsd: Schema.FiniteFromString,
  predictedTotalDebtUsd: Schema.FiniteFromString,
});

export const Action = Schema.Struct({
  ...BorrowApi.ActionDto.fields,
  id: ActionId,
  integrationId: IntegrationId,
  address: WalletAddress,
  transactions: Schema.Array(Transaction),
  rawArguments: Schema.optionalKey(ActionRawArguments),
  metadata: Schema.optionalKey(ActionMetadata),
});
export type Action = typeof Action.Type;

export const isUnsuccessfulBorrowActionStatus = (status: string) =>
  status === "FAILED" || status === "CANCELED" || status === "STALE";

export const isTerminalBorrowActionStatus = (status: string) =>
  status === "SUCCESS" || isUnsuccessfulBorrowActionStatus(status);
