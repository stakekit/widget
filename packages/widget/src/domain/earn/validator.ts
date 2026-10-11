import { addressIdentity } from "../identity/identifiers";
import type { Network } from "../network/network";
import type { EarnValidator } from "./models";

export type ValidatorKey = string;
export type ValidatorInput = Omit<EarnValidator, "key">;

export const validatorAddressIdentity = addressIdentity;

export const validatorAddressIdentities = (addresses: Iterable<string>) => [
  ...new Set(Array.from(addresses, addressIdentity)),
];

/**
 * Substrate nomination accepts at most 16 targets. The API rejects more
 * (`MAXIMUM_VALIDATOR_COUNT` in the backend chains library) without exposing
 * the bound in the argument schema, so it is mirrored here.
 */
const SUBSTRATE_NOMINATION_LIMIT = 16;

const substrateNominationNetworks: ReadonlySet<Network> = new Set([
  "kusama",
  "polkadot",
  "westend",
]);

export const getMaxSelectedValidators = (network: Network): number | null =>
  substrateNominationNetworks.has(network) ? SUBSTRATE_NOMINATION_LIMIT : null;
