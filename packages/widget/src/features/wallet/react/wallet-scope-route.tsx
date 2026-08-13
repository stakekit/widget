import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { createContext, useContext, useRef } from "react";
import { Navigate, Outlet } from "react-router";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
  walletScopeFromState,
} from "../../../services/wallet/wallet-scope";
import { currentWalletStateResultAtom } from "../state/root-atom";

const WalletScopeRouteContext = createContext<WalletScopeKey | null>(null);

type WalletStateResult = Atom.Type<typeof currentWalletStateResultAtom>;

export const WalletScopeRoute = ({
  fallbackPath,
  walletStateResult,
}: {
  readonly fallbackPath: string;
  readonly walletStateResult: WalletStateResult;
}) => {
  const walletState = walletStateResult.pipe(
    AsyncResult.value,
    Option.getOrNull
  );
  const walletScope = walletState ? walletScopeFromState(walletState) : null;
  const initialWalletScope = useRef<WalletScopeKey | null>(null);

  if (walletScope && initialWalletScope.current === null) {
    initialWalletScope.current = walletScope;
  }

  if (walletStateResult.waiting && !walletScope) {
    return null;
  }

  if (
    !walletScope ||
    (initialWalletScope.current &&
      !sameWalletScopeOwner(initialWalletScope.current, walletScope))
  ) {
    return <Navigate to={fallbackPath} replace />;
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
  readonly fallbackPath: string;
}) => {
  const walletStateResult = useAtomValue(currentWalletStateResultAtom);

  return (
    <WalletScopeRoute
      fallbackPath={fallbackPath}
      walletStateResult={walletStateResult}
    />
  );
};

export const useWalletScopeRoute = (): WalletScopeKey => {
  const walletScope = useContext(WalletScopeRouteContext);

  if (walletScope === null) {
    throw new Error("useWalletScopeRoute used outside WalletScopeRouteGuard.");
  }

  return walletScope;
};
