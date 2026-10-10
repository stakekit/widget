import {
  currentWalletConfigResultAtom,
  currentWalletEnabledNetworksResultAtom,
  currentWalletStateResultAtom,
} from "./state/root-atom";
import {
  currentWalletScopeAtom,
  currentWalletStateAtom,
} from "./state/selectors";

export const walletConnectionStateAtom = currentWalletStateAtom;
export const walletConfigResultAtom = currentWalletConfigResultAtom;
export const walletEnabledNetworksResultAtom =
  currentWalletEnabledNetworksResultAtom;
export const walletScopeAtom = currentWalletScopeAtom;
export const walletStateResultAtom = currentWalletStateResultAtom;

export { useSKWallet } from "./react/use-wallet";
export { useWalletConfig } from "./react/use-wallet-config";
export { useWalletScopeRoute } from "./react/wallet-scope-route";
export { selectCurrentWalletAtom } from "./state/selectors";
export { logoutAtom } from "./state/workflows";
