import { Schema } from "effect";
import { MarketId, TokenAddress } from "./ids";

export class WithdrawPendingAction extends Schema.Class<WithdrawPendingAction>(
  "BorrowWithdrawPendingAction"
)({
  type: Schema.Literal("withdraw"),
  label: Schema.String,
  args: Schema.Struct({
    amountRaw: Schema.BigIntFromString,
    tokenAddress: TokenAddress,
    marketId: MarketId,
  }),
}) {}

export class RepayPendingAction extends Schema.Class<RepayPendingAction>(
  "BorrowRepayPendingAction"
)({
  type: Schema.Literal("repay"),
  label: Schema.String,
  args: Schema.Struct({
    tokenAddress: TokenAddress,
    marketId: MarketId,
  }),
}) {}

const CollateralToggleArgs = Schema.Struct({
  tokenAddress: TokenAddress,
  marketId: MarketId,
});

export class EnableCollateralPendingAction extends Schema.Class<EnableCollateralPendingAction>(
  "BorrowEnableCollateralPendingAction"
)({
  type: Schema.Literal("enableCollateral"),
  label: Schema.String,
  args: CollateralToggleArgs,
}) {}

export class DisableCollateralPendingAction extends Schema.Class<DisableCollateralPendingAction>(
  "BorrowDisableCollateralPendingAction"
)({
  type: Schema.Literal("disableCollateral"),
  label: Schema.String,
  args: CollateralToggleArgs,
}) {}

export const PendingAction = Schema.Union([
  WithdrawPendingAction,
  RepayPendingAction,
  EnableCollateralPendingAction,
  DisableCollateralPendingAction,
]);
export type PendingAction = typeof PendingAction.Type;

export const PendingActions = Schema.Array(PendingAction);
export type PendingActions = typeof PendingActions.Type;
