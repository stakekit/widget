import { identity, Schema, SchemaTransformation } from "effect";

import {
  TokenAddress as CanonicalTokenAddress,
  WalletAddress as CanonicalWalletAddress,
} from "../schema/identifiers";

export const ChainId = Schema.String.pipe(Schema.brand("BorrowChainId"));
export type ChainId = typeof ChainId.Type;

export const decodeChainId = Schema.decodeSync(
  Schema.Union([Schema.String, Schema.Number]).pipe(
    Schema.decodeTo(
      ChainId,
      SchemaTransformation.transform({
        decode: (value) => value.toString(),
        encode: identity,
      })
    )
  )
);

export const WalletAddress = Schema.String.check(Schema.isPattern(/^0x/)).pipe(
  Schema.decodeTo(CanonicalWalletAddress)
);
export type WalletAddress = typeof CanonicalWalletAddress.Type;

export const ActionId = Schema.String.pipe(Schema.brand("BorrowActionId"));
export type ActionId = typeof ActionId.Type;

export const IntegrationId = Schema.String.pipe(
  Schema.brand("BorrowIntegrationId")
);
export type IntegrationId = typeof IntegrationId.Type;

export const MarketId = Schema.String.pipe(Schema.brand("BorrowMarketId"));
export type MarketId = typeof MarketId.Type;

export const TokenAddress = Schema.String.pipe(
  Schema.decode(SchemaTransformation.toLowerCase()),
  Schema.decodeTo(CanonicalTokenAddress)
);
export type TokenAddress = typeof CanonicalTokenAddress.Type;

export const TransactionId = Schema.String.pipe(
  Schema.brand("BorrowTransactionId")
);
export type TransactionId = typeof TransactionId.Type;

const AddressedTokenId = Schema.TemplateLiteral([
  Schema.Literal("address:"),
  Schema.NonEmptyString,
  Schema.Literal(":"),
  TokenAddress,
]);
const NativeTokenId = Schema.TemplateLiteral([
  Schema.Literal("native:"),
  Schema.NonEmptyString,
]);

export const TokenId = Schema.Union([AddressedTokenId, NativeTokenId]).pipe(
  Schema.brand("BorrowTokenId")
);
export type TokenId = typeof TokenId.Type;

export const decodeTokenId = ({
  symbol,
  address,
}: {
  readonly symbol: string;
  readonly address?: TokenAddress;
}) =>
  Schema.decodeSync(TokenId)(
    address ? `address:${symbol}:${address}` : `native:${symbol}`
  );
