import type {
  AdditionalAddresses,
  WalletAddresses,
} from "../schema/address-models";

export type AddressesDto = typeof WalletAddresses.Encoded;
export type AddressWithTokenDtoAdditionalAddresses = AdditionalAddresses;
