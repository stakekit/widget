import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { ExactBaseUnitAmount, ExactDecimal } from "../../finance/scalars";
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
  amount: Schema.optionalKey(ExactDecimal),
  amountRaw: Schema.optionalKey(ExactBaseUnitAmount),
  collateralAmount: Schema.optionalKey(ExactDecimal),
  collateralAmountRaw: Schema.optionalKey(ExactBaseUnitAmount),
});

const ActionMetadata = Schema.Struct({
  currentHealthFactor: Schema.NullOr(ExactDecimal),
  predictedHealthFactor: Schema.NullOr(ExactDecimal),
  currentLtv: ExactDecimal,
  predictedLtv: ExactDecimal,
  liquidationThreshold: ExactDecimal,
  predictedTotalSupplyUsd: ExactDecimal,
  predictedTotalDebtUsd: ExactDecimal,
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
