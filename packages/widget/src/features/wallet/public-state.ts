import { currentWalletConfigResultAtom } from "./state/root-atom";
import {
  currentWalletScopeAtom,
  currentWalletStateAtom,
} from "./state/selectors";
import { runAddLedgerAccount } from "./state/workflows";

export const walletConnectionStateAtom = currentWalletStateAtom;
export const walletConfigResultAtom = currentWalletConfigResultAtom;
export const walletScopeAtom = currentWalletScopeAtom;
export { runAddLedgerAccount };
