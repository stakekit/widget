import { isEvmNetwork } from "../network/network";
import type { EarnValidator } from "./models";

export type ValidatorKey = string;
export type ValidatorInput = Omit<EarnValidator, "key">;

export const validatorAddressIdentity = (network: string, address: string) =>
  isEvmNetwork(network) ? address.toLowerCase() : address;

export const validatorAddressIdentities = (
  network: string,
  addresses: Iterable<string>
) => [
  ...new Set(
    Array.from(addresses, (address) =>
      validatorAddressIdentity(network, address)
    )
  ),
];
