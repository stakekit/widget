import { Schema, SchemaTransformation } from "effect";

export const YieldId = Schema.NonEmptyString.pipe(Schema.brand("YieldId"));
export type YieldId = typeof YieldId.Type;

export const ProviderId = Schema.NonEmptyString.pipe(
  Schema.brand("ProviderId")
);
export type ProviderId = typeof ProviderId.Type;

export const ActionId = Schema.NonEmptyString.pipe(Schema.brand("ActionId"));
export type ActionId = typeof ActionId.Type;

export const TransactionId = Schema.NonEmptyString.pipe(
  Schema.brand("TransactionId")
);
export type TransactionId = typeof TransactionId.Type;

export const WalletAddress = Schema.NonEmptyString.pipe(
  Schema.brand("WalletAddress")
);
export type WalletAddress = typeof WalletAddress.Type;

export const TokenAddress = Schema.NonEmptyString.pipe(
  Schema.brand("TokenAddress")
);
export type TokenAddress = typeof TokenAddress.Type;

export const ValidatorAddress = Schema.NonEmptyString.pipe(
  Schema.brand("ValidatorAddress")
);
export type ValidatorAddress = typeof ValidatorAddress.Type;

const EvmAddressString = Schema.String.check(
  Schema.isPattern(/^0x[0-9a-fA-F]{40}$/)
);

export const NormalizedEvmAddress = EvmAddressString.pipe(
  Schema.decode(SchemaTransformation.toLowerCase()),
  Schema.brand("NormalizedEvmAddress")
);
export type NormalizedEvmAddress = typeof NormalizedEvmAddress.Type;
