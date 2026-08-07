import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  ActionId,
  TokenAddress,
  TransactionId,
  ValidatorAddress,
  WalletAddress,
  YieldId,
} from "./identifiers";
import {
  PrecisionDecimalFromString,
  TolerantNullableUtcDateTimeFromString,
  UtcDateTimeFromString,
} from "./scalars";

const ActionToken = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Number.check(Schema.isInt()),
});

const ActionArguments = Schema.Struct({
  ...YieldApi.CreateActionDto.fields.arguments.schema.fields,
  providerId: Schema.optionalKey(YieldId),
  validatorAddress: Schema.optionalKey(ValidatorAddress),
  validatorAddresses: Schema.optionalKey(Schema.Array(ValidatorAddress)),
});

const ManageActionArguments = Schema.Struct({
  ...YieldApi.CreateManageActionDto.fields.arguments.schema.fields,
  providerId: Schema.optionalKey(YieldId),
  validatorAddress: Schema.optionalKey(ValidatorAddress),
  validatorAddresses: Schema.optionalKey(Schema.Array(ValidatorAddress)),
});

const TransactionGasEstimate = Schema.Struct({
  amount: PrecisionDecimalFromString,
  gasLimit: Schema.optionalKey(Schema.String),
  token: ActionToken,
});

export const TransactionGasEstimateJson = Schema.fromJsonString(
  TransactionGasEstimate
);

export const ActionTransaction = Schema.Struct({
  ...YieldApi.TransactionDto.fields,
  broadcastedAt: TolerantNullableUtcDateTimeFromString({
    operation: "yield-action-transaction",
    field: "broadcastedAt",
  }),
  createdAt: UtcDateTimeFromString,
  id: TransactionId,
});
export type ActionTransaction = typeof ActionTransaction.Type;

export const YieldAction = Schema.Struct({
  ...YieldApi.ActionDto.fields,
  address: WalletAddress,
  completedAt: TolerantNullableUtcDateTimeFromString({
    operation: "yield-action",
    field: "completedAt",
  }),
  createdAt: UtcDateTimeFromString,
  id: ActionId,
  rawArguments: Schema.NullOr(ActionArguments),
  transactions: Schema.Array(ActionTransaction),
  yieldId: YieldId,
});
export type YieldAction = typeof YieldAction.Type;

export const ActionCommand = Schema.Struct({
  ...YieldApi.CreateActionDto.fields,
  address: WalletAddress,
  arguments: Schema.optionalKey(ActionArguments),
  yieldId: YieldId,
});
export type ActionCommand = typeof ActionCommand.Type;

export const ManageActionCommand = Schema.Struct({
  ...YieldApi.CreateManageActionDto.fields,
  address: WalletAddress,
  arguments: Schema.optionalKey(ManageActionArguments),
  yieldId: YieldId,
});
export type ManageActionCommand = typeof ManageActionCommand.Type;

export const PendingAction = YieldApi.PendingActionDto;
export type PendingAction = typeof PendingAction.Type;

export const SubmitTransactionHashCommand = Schema.Struct({
  payload: YieldApi.SubmitHashDto,
  transactionId: TransactionId,
});
export type SubmitTransactionHashCommand =
  typeof SubmitTransactionHashCommand.Type;

export const SubmitSignedTransactionCommand = Schema.Struct({
  payload: YieldApi.SubmitTransactionDto,
  transactionId: TransactionId,
});
export type SubmitSignedTransactionCommand =
  typeof SubmitSignedTransactionCommand.Type;

export const TransactionStatusCommand = Schema.Struct({
  transactionId: TransactionId,
});
export type TransactionStatusCommand = typeof TransactionStatusCommand.Type;
