import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  ActionId,
  TokenAddress,
  TransactionId,
  WalletAddress,
  YieldId,
} from "./identifiers";
import { PrecisionDecimalFromString } from "./scalars";

const ActionToken = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Number.check(Schema.isInt()),
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
  id: TransactionId,
});
export type ActionTransaction = typeof ActionTransaction.Type;

export const YieldAction = Schema.Struct({
  ...YieldApi.ActionDto.fields,
  address: WalletAddress,
  id: ActionId,
  transactions: Schema.Array(ActionTransaction),
  yieldId: YieldId,
});
export type YieldAction = typeof YieldAction.Type;

export const ActionCommand = Schema.Struct({
  ...YieldApi.CreateActionDto.fields,
  address: WalletAddress,
  yieldId: YieldId,
});
export type ActionCommand = typeof ActionCommand.Type;

export const ManageActionCommand = Schema.Struct({
  ...YieldApi.CreateManageActionDto.fields,
  address: WalletAddress,
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
