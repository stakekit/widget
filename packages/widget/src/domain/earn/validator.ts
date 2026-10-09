import { addressIdentity } from "../identity/identifiers";
import type { EarnValidator } from "./models";

export type ValidatorKey = string;
export type ValidatorInput = Omit<EarnValidator, "key">;

export const validatorAddressIdentity = addressIdentity;

export const validatorAddressIdentities = (addresses: Iterable<string>) => [
  ...new Set(Array.from(addresses, addressIdentity)),
];
