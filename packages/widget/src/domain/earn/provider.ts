import { Schema, Struct } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { ProviderId } from "../identity/identifiers";
import { TolerantExactDecimal } from "./wire-fields";

// Provider `type` is not picked, so new provider kinds stay decodable.
export const EarnProvider = Schema.Struct({
  ...Struct.pick(YieldApi.ProviderDto.fields, ["name", "logoURI", "website"]),
  id: ProviderId,
  tvlUsd: TolerantExactDecimal("yield-provider", "tvlUsd"),
});
export type EarnProvider = typeof EarnProvider.Type;
