import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../services/wallet/wallet-state";
import { selectAtom } from "../../../shared/effect/select-atom";
import { currentWalletStateResultAtom } from "./root-atom";

export const currentWalletStateAtom = Atom.make((get) =>
  get(currentWalletStateResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedNormalizedWalletState)
  )
).pipe(Atom.withLabel("currentWalletStateAtom"));

export const selectCurrentWalletAtom = <A>(
  select: (state: NormalizedWalletState) => A
): Atom.Atom<A> => selectAtom(currentWalletStateAtom, select);

export const currentWalletConnectedNetworkAtom = selectCurrentWalletAtom(
  (state) => (state.status === "connected" ? state.network : null)
).pipe(Atom.withLabel("currentWalletConnectedNetworkAtom"));

export const currentWalletScopeAtom = selectCurrentWalletAtom(
  walletScopeFromState
).pipe(Atom.withLabel("currentWalletScopeAtom"));
