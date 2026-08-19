import { WalletScopeKey } from "../../domain/wallet/wallet-scope";
import type { NormalizedWalletState } from "./wallet-state";

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
