import { Schema } from "effect";

export const YieldId = Schema.NonEmptyString.pipe(Schema.brand("YieldId"));
export type YieldId = typeof YieldId.Type;

export const ProviderId = Schema.NonEmptyString.pipe(
  Schema.brand("ProviderId")
);
export type ProviderId = typeof ProviderId.Type;

/** A `providerId` argument value exactly as a yield advertises it. Opaque. */
export const ProviderOption = Schema.NonEmptyString.pipe(
  Schema.brand("ProviderOption")
);
export type ProviderOption = typeof ProviderOption.Type;

export const ActionId = Schema.NonEmptyString.pipe(Schema.brand("ActionId"));
export type ActionId = typeof ActionId.Type;

export const TransactionId = Schema.NonEmptyString.pipe(
  Schema.brand("TransactionId")
);
export type TransactionId = typeof TransactionId.Type;

export const TransactionWorkflowId = Schema.NonEmptyString.pipe(
  Schema.brand("TransactionWorkflowId")
);
export type TransactionWorkflowId = typeof TransactionWorkflowId.Type;

/** A transaction's hash on its chain, in that chain's own encoding. */
export const TransactionHash = Schema.NonEmptyString.pipe(
  Schema.brand("TransactionHash")
);
export type TransactionHash = typeof TransactionHash.Type;

/** A signature a wallet produced over a message or typed data. */
export const WalletSignature = Schema.NonEmptyString.pipe(
  Schema.brand("WalletSignature")
);
export type WalletSignature = typeof WalletSignature.Type;

/** A transaction a wallet signed but did not broadcast, in its chain's encoding. */
export const SignedTransactionPayload = Schema.NonEmptyString.pipe(
  Schema.brand("SignedTransactionPayload")
);
export type SignedTransactionPayload = typeof SignedTransactionPayload.Type;

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

/** A smart contract's address on its chain, such as a confidential vault's batcher. */
export const ContractAddress = Schema.NonEmptyString.pipe(
  Schema.brand("ContractAddress")
);
export type ContractAddress = typeof ContractAddress.Type;

const hexAddress = /^0x[0-9a-f]+$/i;

/** 0x-prefixed hex addresses are case-insensitive; other encodings keep their case. */
export const addressIdentity = (address: string) =>
  hexAddress.test(address) ? address.toLowerCase() : address;
