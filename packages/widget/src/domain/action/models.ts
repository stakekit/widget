import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  TolerantNullableUtcDateTimeFromString,
  UtcDateTimeFromString,
} from "../finance/scalars";
import {
  ActionId,
  TransactionId,
  ValidatorAddress,
  WalletAddress,
  YieldId,
} from "../identity/identifiers";
import { Token } from "../token/token";

const PendingActionArgumentField = Schema.Struct({
  ...YieldApi.ArgumentFieldDto.fields,
  maximum: Schema.optionalKey(Schema.NullOr(ExactDecimal)),
  minimum: Schema.optionalKey(Schema.NullOr(ExactDecimal)),
});

const ActionArguments = Schema.Struct({
  ...YieldApi.ActionArgumentsDto.fields,
  providerId: Schema.optionalKey(YieldId),
  validatorAddress: Schema.optionalKey(ValidatorAddress),
  validatorAddresses: Schema.optionalKey(Schema.Array(ValidatorAddress)),
});

const ManageActionArguments = Schema.Struct({
  ...YieldApi.ActionArgumentsDto.fields,
  providerId: Schema.optionalKey(YieldId),
  validatorAddress: Schema.optionalKey(ValidatorAddress),
  validatorAddresses: Schema.optionalKey(Schema.Array(ValidatorAddress)),
});

const TransactionGasEstimate = Schema.Struct({
  amount: ExactDecimal,
  gasLimit: Schema.optionalKey(Schema.String),
  token: Token,
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
  amount: Schema.NullOr(ExactDecimal),
  amountRaw: Schema.NullOr(ExactBaseUnitAmount),
  amountUsd: Schema.NullOr(ExactDecimal),
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

export const PendingAction = Schema.Struct({
  ...YieldApi.PendingActionDto.fields,
  amount: Schema.optionalKey(Schema.NullOr(ExactDecimal)),
  arguments: Schema.optionalKey(
    Schema.Union([
      Schema.Struct({
        ...YieldApi.ArgumentSchemaDto.fields,
        fields: Schema.optionalKey(Schema.Array(PendingActionArgumentField)),
      }),
      Schema.Null,
    ])
  ),
});
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
