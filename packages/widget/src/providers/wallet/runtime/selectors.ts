import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { selectAtom } from "../../../atoms/select-atom";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../domain/state";
import { walletInitializationKeyAtom } from "../wagmi/initialization";
import { walletStateAtom } from "./root-atom";

const currentWalletStateAtom = Atom.make((get) =>
  get(walletStateAtom(get(walletInitializationKeyAtom))).pipe(
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
