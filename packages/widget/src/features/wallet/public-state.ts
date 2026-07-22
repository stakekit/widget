import {
  currentWalletScopeAtom,
  currentWalletStateAtom,
} from "./state/selectors";

export const walletConnectionStateAtom = currentWalletStateAtom;
export const walletScopeAtom = currentWalletScopeAtom;
