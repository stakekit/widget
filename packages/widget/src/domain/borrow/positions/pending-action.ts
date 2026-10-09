import { Schema } from "effect";
import { TolerantArray } from "../../decoding/response-schema";
import { ExactBaseUnitAmount } from "../../finance/scalars";
import { MarketId, TokenAddress } from "../ids";

export const WithdrawPendingAction = Schema.Struct({
  type: Schema.Literal("withdraw"),
  label: Schema.String,
  args: Schema.Struct({
    amountRaw: ExactBaseUnitAmount,
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

const SupportedPendingActionType = Schema.Struct({
  type: Schema.Literals(
    PendingAction.members.map((member) => member.fields.type.literal)
  ),
});
const isSupportedPendingAction = Schema.is(SupportedPendingActionType);

// The API advertises more pending actions than the widget implements. Those,
// and actions added after the client was generated, are skipped instead of
// rejecting the whole account snapshot.
export const PendingActions = TolerantArray(PendingAction, {
  operation: "borrow-pending-actions",
  isSupported: isSupportedPendingAction,
});
export type PendingActions = typeof PendingActions.Type;
