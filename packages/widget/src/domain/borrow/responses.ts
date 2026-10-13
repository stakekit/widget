import { Schema, SchemaGetter } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TolerantArray } from "../decoding/response-schema";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  UtcDateTimeFromString,
} from "../finance/scalars";
import { Integration } from "./catalog/integration";
import { Market } from "./catalog/market";
import { ActionId, MarketId, TokenAddress } from "./ids";
import { BorrowNetwork } from "./network";
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
  ...BorrowApi.MarketsControllerGetMarketsV1200.fields,
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
  amount: Schema.optionalKey(ExactDecimal),
  amountRaw: Schema.optionalKey(ExactBaseUnitAmount),
});

/**
 * A listed Borrow action, dated like Yield Activity so both feeds sort together.
 * Only the fields an Activity row reads are decoded, so malformed execution
 * metadata cannot drop a historical row.
 */
export const BorrowActivityAction = Schema.Struct({
  id: ActionId,
  action: BorrowApi.ActionDto.fields.action,
  status: BorrowApi.ActionDto.fields.status,
  createdAt: UtcDateTimeFromString,
  rawArguments: Schema.optionalKey(BorrowActivityRawArguments),
  transactions: Schema.Array(Schema.Struct({ network: BorrowNetwork })),
});
export type BorrowActivityAction = typeof BorrowActivityAction.Type;

// The generated list response declares `items: never`; the API returns actions.
export const BorrowActionsPage = Schema.Struct({
  ...BorrowApi.ActionsControllerGetActionsV1200.fields,
  items: Schema.optionalKey(
    TolerantArray(BorrowActivityAction, {
      operation: "borrow-actions",
      identifier: ItemIdentifier,
    })
  ),
});
export type BorrowActionsPage = typeof BorrowActionsPage.Type;
