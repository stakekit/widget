import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  refreshTokenBalancesAtom,
  tokenBalancesResourceAtom,
} from "../../../../resources/token-balances/token-balances";
import { walletScopeAtom } from "../../../wallet/state";

const tokenBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(walletScopeAtom);

  return scope
    ? get(tokenBalancesResourceAtom.foreground(scope))
    : AsyncResult.success([]);
}).pipe(Atom.withLabel("currentTokenBalancesScanResourceAtom"));

export const tokenBalancesScanAtom = Atom.writable(
  (get) => ({
    enabled: get(walletScopeAtom) !== null,
    result: get(tokenBalancesScanResourceAtom),
  }),
  (get) => {
    const scope = get.get(walletScopeAtom);
    if (scope) get.set(refreshTokenBalancesAtom(scope), undefined);
  }
).pipe(Atom.withLabel("tokenBalancesScanAtom"));
