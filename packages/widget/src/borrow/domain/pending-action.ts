import { Array as EffectArray, Schema, SchemaGetter } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { MarketId, TokenAddress } from "./ids";
import { BigIntFromString } from "./scalars";

export class WithdrawPendingAction extends Schema.Class<WithdrawPendingAction>(
  "BorrowWithdrawPendingAction"
)({
  type: Schema.Literal("withdraw"),
  label: Schema.String,
  args: Schema.Struct({
    amountRaw: BigIntFromString,
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

export const PendingActionsFromDto = Schema.Array(
  BorrowApi.BorrowPendingActionDto
).pipe(
  Schema.decodeTo(Schema.Array(PendingAction), {
    decode: SchemaGetter.transform((items) =>
      EffectArray.getSomes(
        items.map((action) =>
          Schema.decodeUnknownOption(Schema.toEncoded(PendingAction))(action)
        )
      )
    ),
    encode: SchemaGetter.forbidden(() => "Cannot encode PendingActionsFromDto"),
  })
);
