import { useAtomMount, useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { Navigate, Outlet } from "react-router";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../services/wallet/domain/scope";
import { makeRequiredAtomRoute } from "../../../shared/react/required-atom-route";
import { useWalletScopeRoute } from "./wallet-scope-route";

export const makeWalletScopedAtomRoute = <
  A extends { readonly walletScope: WalletScopeKey },
>(
  atom: Atom.Atom<A | null>,
  lifecycleAtom: Atom.Atom<void>,
  name: string,
  fallbackPath = "/"
) => {
  const requiredRoute = makeRequiredAtomRoute(atom, name);

  const RouteGuard = () => {
    useAtomMount(lifecycleAtom);
    const value = useAtomValue(atom);
    const walletScope = useWalletScopeRoute();

    if (!value || !sameWalletScopeOwner(value.walletScope, walletScope)) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <requiredRoute.Provider value={value}>
        <Outlet />
      </requiredRoute.Provider>
    );
  };
  RouteGuard.displayName = `${name}WalletScopedRouteGuard`;

  return { ...requiredRoute, RouteGuard } as const;
};
