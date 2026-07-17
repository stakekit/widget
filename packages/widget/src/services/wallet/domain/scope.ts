import { Data } from "effect";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import {
  isEvmChain,
  type SupportedSKChains,
} from "../../../domain/types/chains";
import type { NormalizedWalletState } from "./state";

const normalizeStrings = (values: ReadonlyArray<string>) =>
  [...new Set(values)].sort();

const normalizeAdditionalAddresses = (
  addresses: AdditionalAddresses | null | undefined
): AdditionalAddresses | null => {
  if (!addresses) return null;

  if ("stakeAccounts" in addresses) {
    return {
      ...addresses,
      lidoStakeAccounts: normalizeStrings(addresses.lidoStakeAccounts),
      stakeAccounts: normalizeStrings(addresses.stakeAccounts),
    };
  }

  return { ...addresses };
};

export class WalletScopeKey extends Data.TaggedClass("WalletScopeKey")<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress;
  readonly network: SupportedSKChains;
}> {
  constructor(input: {
    readonly additionalAddresses?: AdditionalAddresses | null;
    readonly address: WalletAddress;
    readonly network: SupportedSKChains;
  }) {
    super({
      ...input,
      additionalAddresses: normalizeAdditionalAddresses(
        input.additionalAddresses
      ),
    });
  }
}

type WalletScopeOwner = {
  readonly address: string;
  readonly network: SupportedSKChains;
};

export const sameWalletScopeOwner = (
  first: WalletScopeOwner,
  second: WalletScopeOwner
): boolean =>
  first.network === second.network &&
  (isEvmChain(first.network)
    ? first.address.toLowerCase() === second.address.toLowerCase()
    : first.address === second.address);

export const walletScopeFromState = (
  state: NormalizedWalletState
): WalletScopeKey | null =>
  state.status === "connected"
    ? new WalletScopeKey({
        additionalAddresses: state.additionalAddresses,
        address: state.address,
        network: state.network,
      })
    : null;
