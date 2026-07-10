import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import { WalletAddress } from "./identifiers";

export const AdditionalAddresses = Schema.Union([
  LegacyApi.CosmosAdditionalAddressesDto,
  LegacyApi.BinanceAdditionalAddressesDto,
  LegacyApi.SolanaAdditionalAddressesDto,
  LegacyApi.TezosAdditionalAddressesDto,
  LegacyApi.AvalancheCAdditionalAddressesDto,
]);
export type AdditionalAddresses = typeof AdditionalAddresses.Type;

export const WalletAddresses = Schema.Struct({
  ...LegacyApi.AddressesDto.fields,
  address: WalletAddress,
  additionalAddresses: Schema.optionalKey(AdditionalAddresses),
});
export type WalletAddresses = typeof WalletAddresses.Type;
