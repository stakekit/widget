import { Option, Schema, Struct } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  addressIdentity,
  ProviderId,
  ValidatorAddress,
} from "../identity/identifiers";
import type { Network } from "../network/network";
import { EarnRewardRate, TolerantExactDecimal } from "./wire-fields";

export const EarnValidatorKey = Schema.NonEmptyString.pipe(
  Schema.brand("EarnValidatorKey")
);
export type EarnValidatorKey = typeof EarnValidatorKey.Type;

const makeEarnValidatorKey = Schema.decodeSync(EarnValidatorKey);

// `tvlRaw` is not decoded: TVL is displayed in token units from `tvl`.
const EarnValidatorWire = Schema.Struct({
  ...Struct.pick(YieldApi.ValidatorDto.fields, [
    "name",
    "logoURI",
    "website",
    "commission",
    "votingPower",
    "preferred",
    "nominatorCount",
    "status",
    "subnet",
  ]),
  address: ValidatorAddress,
  providerId: Schema.optionalKey(ProviderId),
  rewardRate: Schema.optionalKey(EarnRewardRate),
  tvl: Schema.optionalKey(TolerantExactDecimal("yield-validator", "tvl")),
});

export const EarnValidator = EarnValidatorWire.pipe(
  Schema.extendTo(
    { key: EarnValidatorKey },
    {
      key: (validator) =>
        Option.some(
          makeEarnValidatorKey(
            validator.subnet?.id === undefined
              ? validator.address
              : `${validator.address}:${validator.subnet.id}`
          )
        ),
    }
  )
);
export type EarnValidator = typeof EarnValidator.Type;

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
