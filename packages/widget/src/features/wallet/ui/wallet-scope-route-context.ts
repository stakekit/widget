import { createContext, useContext } from "react";

import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

export const WalletScopeRouteContext = createContext<WalletScopeKey | null>(
  null
);

export const useWalletScopeRoute = (): WalletScopeKey => {
  const walletScope = useContext(WalletScopeRouteContext);

  if (walletScope === null) {
    throw new Error("useWalletScopeRoute used outside WalletScopeRouteGuard.");
  }

  return walletScope;
};
