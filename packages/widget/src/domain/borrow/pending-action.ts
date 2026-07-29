import { Schema } from "effect";
import { MarketId, TokenAddress } from "./ids";

export const WithdrawPendingAction = Schema.Struct({
  type: Schema.Literal("withdraw"),
  label: Schema.String,
  args: Schema.Struct({
    amountRaw: Schema.BigIntFromString,
    tokenAddress: TokenAddress,
    marketId: MarketId,
  }),
});
export type WithdrawPendingAction = typeof WithdrawPendingAction.Type;

export const RepayPendingAction = Schema.Struct({
  type: Schema.Literal("repay"),
  label: Schema.String,
  args: Schema.Struct({
    tokenAddress: TokenAddress,
    marketId: MarketId,
  }),
});
export type RepayPendingAction = typeof RepayPendingAction.Type;

const CollateralToggleArgs = Schema.Struct({
  tokenAddress: TokenAddress,
  marketId: MarketId,
});

export const EnableCollateralPendingAction = Schema.Struct({
  type: Schema.Literal("enableCollateral"),
  label: Schema.String,
  args: CollateralToggleArgs,
});
export type EnableCollateralPendingAction =
  typeof EnableCollateralPendingAction.Type;

export const DisableCollateralPendingAction = Schema.Struct({
  type: Schema.Literal("disableCollateral"),
  label: Schema.String,
  args: CollateralToggleArgs,
});
export type DisableCollateralPendingAction =
  typeof DisableCollateralPendingAction.Type;

export const PendingAction = Schema.Union([
  WithdrawPendingAction,
  RepayPendingAction,
  EnableCollateralPendingAction,
  DisableCollateralPendingAction,
]);
export type PendingAction = typeof PendingAction.Type;

export const PendingActions = Schema.Array(PendingAction);
export type PendingActions = typeof PendingActions.Type;
