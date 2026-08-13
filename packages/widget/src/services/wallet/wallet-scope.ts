import { Data } from "effect";
import type { WalletAddress } from "../../domain/identity/identifiers";
import type { AdditionalAddresses } from "../../domain/wallet/address";
import {
  isEvmChain,
  type SupportedSKChains,
} from "../../services/wallet/supported-chains";
import type { NormalizedWalletState } from "./wallet-state";

export type WalletCommandIdentity = Readonly<{
  readonly address: string | null;
  readonly chainId: number | null;
  readonly connectorUid: string | null;
  readonly network: SupportedSKChains | null;
  readonly status: NormalizedWalletState["status"];
}>;

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

export class WalletScopeOwnerKey extends Data.TaggedClass(
  "WalletScopeOwnerKey"
)<{
  readonly address: WalletAddress;
  readonly network: SupportedSKChains;
}> {}

export const walletScopeOwnerKey = (
  scope: Pick<WalletScopeKey, "address" | "network">
) =>
  new WalletScopeOwnerKey({
    address: isEvmChain(scope.network)
      ? (scope.address.toLowerCase() as WalletAddress)
      : scope.address,
    network: scope.network,
  });

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

export const walletCommandIdentity = (
  state: NormalizedWalletState
): WalletCommandIdentity => ({
  address:
    state.status === "connected" && isEvmChain(state.network)
      ? state.address.toLowerCase()
      : state.address,
  chainId: state.chain?.id ?? null,
  connectorUid: state.connector?.uid ?? null,
  network: state.network,
  status: state.status,
});

export const sameWalletCommandIdentity = (
  first: WalletCommandIdentity,
  second: WalletCommandIdentity
): boolean =>
  first.status === second.status &&
  first.address === second.address &&
  first.chainId === second.chainId &&
  first.connectorUid === second.connectorUid &&
  first.network === second.network;

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
