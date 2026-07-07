import { identity, Schema, SchemaTransformation } from "effect";

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

export const WalletAddress = Schema.TemplateLiteral([
  Schema.Literal("0x"),
  Schema.String,
]).pipe(Schema.brand("BorrowWalletAddress"));
export type WalletAddress = typeof WalletAddress.Type;
export const decodeWalletAddress = Schema.decodeUnknownSync(WalletAddress);

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
  Schema.brand("BorrowTokenAddress")
);
export type TokenAddress = typeof TokenAddress.Type;

export const TransactionId = Schema.String.pipe(
  Schema.brand("BorrowTransactionId")
);
export type TransactionId = typeof TransactionId.Type;

const TokenId = Schema.TemplateLiteral([
  Schema.String,
  Schema.Literal("::"),
  TokenAddress,
]).pipe(Schema.brand("BorrowTokenId"));

export const decodeTokenId = ({
  symbol,
  address,
}: {
  readonly symbol: string;
  readonly address?: TokenAddress;
}) => Schema.decodeSync(TokenId)(`${symbol}::${address ?? ""}`);
