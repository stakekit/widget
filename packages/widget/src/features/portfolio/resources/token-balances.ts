import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  refreshTokenBalancesAtom,
  tokenBalancesResourceAtom,
} from "../../../resources/token-balances/token-balances";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";

const tokenBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(currentWalletScopeAtom);

  return scope
    ? get(tokenBalancesResourceAtom(scope))
    : AsyncResult.success([]);
}).pipe(Atom.withLabel("currentTokenBalancesScanResourceAtom"));

export const tokenBalancesScanAtom = Atom.writable(
  (get) => ({
    enabled: get(currentWalletScopeAtom) !== null,
    result: get(tokenBalancesScanResourceAtom),
  }),
  (get) => {
    const scope = get.get(currentWalletScopeAtom);
    if (scope) get.set(refreshTokenBalancesAtom(scope), undefined);
  }
).pipe(Atom.withLabel("tokenBalancesScanAtom"));
