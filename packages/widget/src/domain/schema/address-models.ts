import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";

export const AdditionalAddresses = Schema.Union([
  LegacyApi.CosmosAdditionalAddressesDto,
  LegacyApi.BinanceAdditionalAddressesDto,
  LegacyApi.SolanaAdditionalAddressesDto,
  LegacyApi.TezosAdditionalAddressesDto,
  LegacyApi.AvalancheCAdditionalAddressesDto,
]);
export type AdditionalAddresses = typeof AdditionalAddresses.Type;
