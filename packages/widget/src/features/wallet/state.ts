import {
  currentWalletConfigResultAtom,
  currentWalletLedgerStateAtom,
  currentWalletStateResultAtom,
} from "./state/root-atom";
import {
  currentWalletConnectedNetworkAtom,
  currentWalletScopeAtom,
  currentWalletStateAtom,
} from "./state/selectors";

export const walletConnectionStateAtom = currentWalletStateAtom;
export const walletConfigResultAtom = currentWalletConfigResultAtom;
export const walletLedgerStateAtom = currentWalletLedgerStateAtom;
export const walletScopeAtom = currentWalletScopeAtom;
export const walletStateResultAtom = currentWalletStateResultAtom;
export const walletConnectedNetworkAtom = currentWalletConnectedNetworkAtom;

export { useLedgerDisabledChain } from "./react/use-ledger-disabled-chains";
export { useLogout } from "./react/use-logout";
export { useSKWallet } from "./react/use-wallet";
export { useWalletConfig } from "./react/use-wallet-config";
export { selectCurrentWalletAtom } from "./state/selectors";
export { walletModalAdapterAtom } from "./state/wallet-modal";
export {
  addLedgerAccountAtom,
  runAddLedgerAccount,
  runLogout,
} from "./state/workflows";
