import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { Outlet } from "react-router";

import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import type { WidgetPath } from "../../../services/navigation/widget-routes";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import type { NormalizedWalletState } from "../../../services/wallet/wallet-state";
import { WidgetNavigate } from "../../navigation/views";
import { walletConnectionStateAtom } from "../state/selectors";
import { WalletScopeRouteContext } from "./wallet-scope-route-context";

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
  const walletState = useAtomValue(walletConnectionStateAtom);

  return (
    <WalletScopeRoute fallbackPath={fallbackPath} walletState={walletState} />
  );
};
