import { useAtomValue } from "@effect/atom-react";
import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import type { WidgetPath } from "../../../services/navigation/widget-routes";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import type { NormalizedWalletState } from "../../../services/wallet/wallet-state";
import { WidgetNavigate } from "../../navigation/views";
import { currentWalletStateAtom } from "../state/selectors";

const WalletScopeRouteContext = createContext<WalletScopeKey | null>(null);

export const WalletScopeRoute = ({
  fallbackPath,
  walletState,
}: {
  readonly fallbackPath: WidgetPath;
  readonly walletState: NormalizedWalletState;
}) => {
  const walletScope = walletScopeFromState(walletState);
  const [initialWalletScope, setInitialWalletScope] =
    useState<WalletScopeKey | null>(null);

  if (walletScope !== null && initialWalletScope === null) {
    setInitialWalletScope(walletScope);
  }

  if (
    !walletScope ||
    (initialWalletScope !== null &&
      !sameWalletScopeOwner(initialWalletScope, walletScope))
  ) {
    return <WidgetNavigate replace to={fallbackPath} />;
  }

  return (
    <WalletScopeRouteContext.Provider value={walletScope}>
      <Outlet />
    </WalletScopeRouteContext.Provider>
  );
};

export const WalletScopeRouteGuard = ({
  fallbackPath,
}: {
  readonly fallbackPath: WidgetPath;
}) => {
  const walletState = useAtomValue(currentWalletStateAtom);

  return (
    <WalletScopeRoute fallbackPath={fallbackPath} walletState={walletState} />
  );
};

export const useWalletScopeRoute = (): WalletScopeKey => {
  const walletScope = useContext(WalletScopeRouteContext);

  if (walletScope === null) {
    throw new Error("useWalletScopeRoute used outside WalletScopeRouteGuard.");
  }

  return walletScope;
};
