import { Schema, SchemaGetter, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray } from "../decoding/response-schema";
import { ProviderId } from "../identity/identifiers";
import { TolerantExactDecimal } from "./wire-fields";

// Provider `type` is not picked, so new provider kinds stay decodable.
export const EarnProvider = Schema.Struct({
  ...Struct.pick(YieldApi.ProviderDto.fields, ["name", "logoURI", "website"]),
  id: ProviderId,
  tvlUsd: TolerantExactDecimal("yield-provider", "tvlUsd"),
});
export type EarnProvider = typeof EarnProvider.Type;

const ProviderIdentifier = Schema.Struct({ id: ProviderId }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Provider identifier is decode-only"),
  })
);

/** A page of the provider list; an unreadable provider is left out of it. */
export const EarnProviderPage = Schema.Struct({
  // Pagination reads these to request the remaining pages.
  ...Struct.pick(YieldApi.ProvidersControllerGetProviders200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: TolerantArray(EarnProvider, {
    operation: "yield-providers",
    identifier: ProviderIdentifier,
  }),
});
export type EarnProviderPage = typeof EarnProviderPage.Type;
