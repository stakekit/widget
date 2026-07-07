import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { ActionId, IntegrationId, MarketId } from "./ids";
import { BigIntFromString, NumberFromString } from "./scalars";
import { Transaction } from "./transaction";

class ActionRawArguments extends Schema.Class<ActionRawArguments>(
  "BorrowActionRawArguments"
)({
  ...BorrowApi.ActionDto.fields.rawArguments.schema.fields,
  marketId: MarketId,
  amount: Schema.optionalKey(NumberFromString),
  amountRaw: Schema.optionalKey(BigIntFromString),
  collateralAmount: Schema.optionalKey(NumberFromString),
  collateralAmountRaw: Schema.optionalKey(BigIntFromString),
}) {}

class ActionMetadata extends Schema.Class<ActionMetadata>(
  "BorrowActionMetadata"
)({
  currentHealthFactor: Schema.NullOr(NumberFromString),
  predictedHealthFactor: Schema.NullOr(NumberFromString),
  currentLtv: NumberFromString,
  predictedLtv: NumberFromString,
  liquidationThreshold: NumberFromString,
  predictedTotalSupplyUsd: NumberFromString,
  predictedTotalDebtUsd: NumberFromString,
}) {}

export class Action extends Schema.Class<Action>("BorrowAction")({
  ...BorrowApi.ActionDto.fields,
  id: ActionId,
  integrationId: IntegrationId,
  transactions: Schema.Array(Transaction),
  rawArguments: Schema.optionalKey(ActionRawArguments),
  metadata: Schema.optionalKey(ActionMetadata),
}) {}
