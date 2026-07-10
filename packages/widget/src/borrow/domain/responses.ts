import { Schema, SchemaGetter } from "effect";
import { TolerantTopLevelArray } from "../../domain/schema/response";
import * as BorrowApi from "../../generated/api/borrow";
import { Integration } from "./integration";
import { Market } from "./market";
import { BorrowAccountPosition } from "./position";

const ItemIdentifier = Schema.Struct({ id: Schema.String }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Item identifier is decode-only"),
  })
);

export const BorrowIntegrationsResponse = TolerantTopLevelArray(Integration, {
  operation: "borrow-integrations",
  identifier: ItemIdentifier,
});

const BorrowMarketItems = TolerantTopLevelArray(Market, {
  operation: "borrow-markets",
  identifier: ItemIdentifier,
});

export const BorrowMarketsResponse = Schema.Struct({
  ...BorrowApi.MarketsControllerGetMarketsV1200.fields,
  items: Schema.optionalKey(BorrowMarketItems),
});

const IntegrationPositionResponse = Schema.Struct({
  integration: Schema.toType(Integration),
  position: BorrowAccountPosition,
});

export const BorrowIntegrationPositionsResponse = TolerantTopLevelArray(
  IntegrationPositionResponse,
  { operation: "borrow-positions" }
);
