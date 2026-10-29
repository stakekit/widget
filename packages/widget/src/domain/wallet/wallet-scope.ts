import { Data } from "effect";
import { WalletAddress } from "../identity/identifiers";
import type { AdditionalAddresses } from "./address";
import { isEvmWalletNetwork, type WalletNetwork } from "./network";

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
  readonly network: WalletNetwork;
}> {
  constructor(input: {
    readonly additionalAddresses?: AdditionalAddresses | null;
    readonly address: WalletAddress;
    readonly network: WalletNetwork;
  }) {
    super({
      ...input,
      additionalAddresses: normalizeAdditionalAddresses(
        input.additionalAddresses
      ),
    });
  }
}

export class WalletScopeOwnerKey extends Data.TaggedClass(
  "WalletScopeOwnerKey"
)<{
  readonly address: WalletAddress;
  readonly network: WalletNetwork;
}> {}

export const walletScopeOwnerKey = (
  scope: Pick<WalletScopeKey, "address" | "network">
) =>
  new WalletScopeOwnerKey({
    // Lowercasing a non-empty address keeps it non-empty, so `make` cannot throw.
    address: isEvmWalletNetwork(scope.network)
      ? WalletAddress.make(scope.address.toLowerCase())
      : scope.address,
    network: scope.network,
  });

export type WalletScopeOwner = {
  readonly address: WalletAddress;
  readonly network: WalletNetwork;
};

export const sameWalletScopeOwner = (
  first: WalletScopeOwner,
  second: WalletScopeOwner
): boolean =>
  first.network === second.network &&
  (isEvmWalletNetwork(first.network)
    ? first.address.toLowerCase() === second.address.toLowerCase()
    : first.address === second.address);
