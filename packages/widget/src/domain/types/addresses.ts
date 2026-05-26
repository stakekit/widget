import type {
  AddressesDto,
  AddressWithTokenDto as LegacyAddressWithTokenDto,
} from "../../generated/api/legacy";

export type AddressWithTokenDto = LegacyAddressWithTokenDto;
export type AddressWithTokenDtoAdditionalAddresses = NonNullable<
  LegacyAddressWithTokenDto["additionalAddresses"]
>;
export type { AddressesDto };
