import { Schema, Struct } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  NonNegativeExactDecimal,
} from "../../finance/scalars";
import {
  ActionId,
  IntegrationId,
  MarketId,
  TokenAddress,
  WalletAddress,
} from "../ids";
import { Transaction } from "./transaction";

const ActionRawArguments = Schema.Struct({
  ...Struct.pick(BorrowApi.ArgumentsDto.fields, [
    "repayAll",
    "borrowAmount",
    "targetLtv",
  ]),
  marketId: MarketId,
  tokenAddress: Schema.optionalKey(TokenAddress),
  collateralTokenAddress: Schema.optionalKey(TokenAddress),
  amount: Schema.optionalKey(ExactDecimal),
  amountRaw: Schema.optionalKey(ExactBaseUnitAmount),
  collateralAmount: Schema.optionalKey(ExactDecimal),
  collateralAmountRaw: Schema.optionalKey(ExactBaseUnitAmount),
});

export const ActionMetadata = Schema.Struct({
  currentHealthFactor: Schema.NullOr(ExactDecimal),
  predictedHealthFactor: Schema.NullOr(ExactDecimal),
  currentLtv: ExactDecimal,
  predictedLtv: ExactDecimal,
  liquidationThreshold: ExactDecimal,
  predictedTotalSupplyUsd: ExactDecimal,
  predictedTotalDebtUsd: ExactDecimal,
  originationFeeAmount: Schema.optionalKey(NonNegativeExactDecimal),
  effectivePrincipalAmount: Schema.optionalKey(NonNegativeExactDecimal),
  feeAmount: Schema.optionalKey(NonNegativeExactDecimal),
  effectiveCollateralAmount: Schema.optionalKey(NonNegativeExactDecimal),
});
export type ActionMetadata = typeof ActionMetadata.Type;

export const Action = Schema.Struct({
  ...Struct.pick(BorrowApi.ActionDto.fields, [
    "action",
    "status",
    "hasNextStep",
    "currentStep",
    "totalSteps",
  ]),
  id: ActionId,
  integrationId: IntegrationId,
  address: WalletAddress,
  transactions: Schema.Array(Transaction),
  rawArguments: Schema.optionalKey(ActionRawArguments),
  metadata: Schema.optionalKey(ActionMetadata),
});
export type Action = typeof Action.Type;

/** Every action status is classified, so a new one must be placed here. */
const borrowActionStatusOutcome = {
  CREATED: "Running",
  WAITING_FOR_NEXT: "Running",
  PROCESSING: "Running",
  SUCCESS: "Succeeded",
  FAILED: "Unsuccessful",
  CANCELED: "Unsuccessful",
  STALE: "Unsuccessful",
} as const satisfies Record<
  Action["status"],
  "Running" | "Succeeded" | "Unsuccessful"
>;

export const isUnsuccessfulBorrowActionStatus = (status: Action["status"]) =>
  borrowActionStatusOutcome[status] === "Unsuccessful";

export const isTerminalBorrowActionStatus = (status: Action["status"]) =>
  borrowActionStatusOutcome[status] !== "Running";
