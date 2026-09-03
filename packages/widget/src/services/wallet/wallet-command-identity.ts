import { isEvmWalletNetwork } from "../../domain/wallet/network";
import type { NormalizedWalletState } from "./wallet-state";

export type WalletCommandIdentity = Readonly<{
  readonly address: string | null;
  readonly chainId: number | null;
  readonly connectorUid: string | null;
  readonly network: NormalizedWalletState["network"];
  readonly status: NormalizedWalletState["status"];
}>;

export const walletCommandIdentity = (
  state: NormalizedWalletState
): WalletCommandIdentity => ({
  address:
    state.status === "connected" && isEvmWalletNetwork(state.network)
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
