import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  refreshYieldPositionsAtom,
  yieldPositionsResourceAtom,
} from "../../../resources/yield-positions/yield-positions";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";

const yieldBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(currentWalletScopeAtom);

  return scope
    ? get(yieldPositionsResourceAtom(scope))
    : AsyncResult.success({ errors: [], items: [] });
}).pipe(Atom.withLabel("currentYieldBalancesScanResourceAtom"));

export const yieldBalancesScanAtom = Atom.writable(
  (get) => ({
    enabled: get(currentWalletScopeAtom) !== null,
    result: get(yieldBalancesScanResourceAtom),
  }),
  (get) => {
    const scope = get.get(currentWalletScopeAtom);
    if (scope) get.set(refreshYieldPositionsAtom(scope), undefined);
  }
).pipe(Atom.withLabel("yieldBalancesScanAtom"));
