import { Schema, SchemaGetter, Struct } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  UtcDateTimeFromString,
} from "../finance/scalars";
import { Integration } from "./catalog/integration";
import { Market } from "./catalog/market";
import { ActionMetadata } from "./execution/action";
import { Transaction } from "./execution/transaction";
import {
  ActionId,
  IntegrationId,
  MarketId,
  TokenAddress,
  WalletAddress,
} from "./ids";
import { BorrowAccountSnapshot } from "./positions/borrow-account-snapshot";

const ItemIdentifier = Schema.Struct({ id: Schema.String }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Item identifier is decode-only"),
  })
);

export const BorrowIntegrationsResponse = TolerantArray(Integration, {
  operation: "borrow-integrations",
  identifier: ItemIdentifier,
});

const BorrowMarketItems = TolerantArray(Market, {
  operation: "borrow-markets",
  identifier: ItemIdentifier,
});

export const BorrowMarketsResponse = Schema.Struct({
  // Pagination reads these to request the remaining pages.
  ...Struct.pick(BorrowApi.MarketsControllerGetMarketsV1200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(BorrowMarketItems),
});

const IntegrationPositionResponse = Schema.Struct({
  integration: Schema.toType(Integration),
  position: BorrowAccountSnapshot,
});

export const BorrowIntegrationPositionsResponse = TolerantArray(
  IntegrationPositionResponse,
  { operation: "borrow-positions" }
);

const BorrowActivityRawArguments = Schema.Struct({
  marketId: MarketId,
  tokenAddress: Schema.optionalKey(TokenAddress),
  collateralTokenAddress: Schema.optionalKey(TokenAddress),
  amount: Schema.optionalKey(ExactDecimal),
  amountRaw: Schema.optionalKey(ExactBaseUnitAmount),
});

const BorrowActivityTransaction = Schema.Struct(
  Struct.pick(Transaction.fields, ["id", "network", "status", "type"])
);

const BorrowActivityMetadata = Schema.Struct(
  Struct.pick(ActionMetadata.fields, [
    "currentHealthFactor",
    "predictedHealthFactor",
    "currentLtv",
    "predictedLtv",
    "originationFeeAmount",
    "feeAmount",
  ])
);

/**
 * A listed Borrow action, dated like Yield Activity so both feeds sort together.
 * Only the fields Activity rows and details read are decoded, so malformed
 * execution data cannot drop a historical row; malformed metadata reads as null.
 */
export const BorrowActivityAction = Schema.Struct({
  id: ActionId,
  integrationId: IntegrationId,
  address: WalletAddress,
  action: BorrowApi.ActionDto.fields.action,
  status: BorrowApi.ActionDto.fields.status,
  createdAt: UtcDateTimeFromString,
  rawArguments: Schema.optionalKey(BorrowActivityRawArguments),
  metadata: Schema.optionalKey(
    TolerantNullOr(BorrowActivityMetadata, {
      operation: "borrow-actions",
      field: "metadata",
    })
  ),
  transactions: Schema.Array(BorrowActivityTransaction),
});
export type BorrowActivityAction = typeof BorrowActivityAction.Type;

// The generated list response declares `items: never`; the API returns actions.
export const BorrowActionsPage = Schema.Struct({
  ...Struct.pick(BorrowApi.ActionsControllerGetActionsV1200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(
    TolerantArray(BorrowActivityAction, {
      operation: "borrow-actions",
      identifier: ItemIdentifier,
    })
  ),
});
export type BorrowActionsPage = typeof BorrowActionsPage.Type;
