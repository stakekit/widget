import {
  currentWalletConfigResultAtom,
  currentWalletStateResultAtom,
} from "./state/root-atom";
import {
  currentWalletConnectedNetworkAtom,
  currentWalletScopeAtom,
  currentWalletStateAtom,
} from "./state/selectors";

export const walletConnectionStateAtom = currentWalletStateAtom;
export const walletConfigResultAtom = currentWalletConfigResultAtom;
export const walletScopeAtom = currentWalletScopeAtom;
export const walletStateResultAtom = currentWalletStateResultAtom;
export const walletConnectedNetworkAtom = currentWalletConnectedNetworkAtom;

export { useLedgerDisabledChain } from "./react/use-ledger-disabled-chains";
export { useSKWallet } from "./react/use-wallet";
export { useWalletConfig } from "./react/use-wallet-config";
export { selectCurrentWalletAtom } from "./state/selectors";
export { walletModalAdapterAtom } from "./state/wallet-modal";
export {
  addLedgerAccountAtom,
  logoutAtom,
} from "./state/workflows";
