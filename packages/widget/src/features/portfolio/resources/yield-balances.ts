import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  refreshYieldPositionsAtom,
  yieldPositionsResourceAtom,
} from "../../../resources/yield-positions/yield-positions";
import { walletScopeAtom } from "../../wallet/state";

const yieldBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(walletScopeAtom);

  return scope
    ? get(yieldPositionsResourceAtom(scope))
    : AsyncResult.success({ errors: [], items: [] });
}).pipe(Atom.withLabel("currentYieldBalancesScanResourceAtom"));

export const yieldBalancesScanAtom = Atom.writable(
  (get) => ({
    enabled: get(walletScopeAtom) !== null,
    result: get(yieldBalancesScanResourceAtom),
  }),
  (get) => {
    const scope = get.get(walletScopeAtom);
    if (scope) get.set(refreshYieldPositionsAtom(scope), undefined);
  }
).pipe(Atom.withLabel("yieldBalancesScanAtom"));
