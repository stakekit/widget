import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { walletScopeFromState } from "../../../services/wallet/wallet-scope-adapter";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../services/wallet/wallet-state";
import { selectAtom } from "../../../shared/effect/select-atom";
import { walletStateResultAtom } from "./root-atom";

export const walletConnectionStateAtom = Atom.make((get) =>
  get(walletStateResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => disconnectedNormalizedWalletState)
  )
).pipe(Atom.withLabel("walletConnectionStateAtom"));

/** The wallet's state once known; null until then. */
export const knownWalletStateAtom = Atom.make((get) =>
  get(walletStateResultAtom).pipe(AsyncResult.value, Option.getOrNull)
).pipe(Atom.withLabel("knownWalletStateAtom"));

export const selectCurrentWalletAtom = <A>(
  select: (state: NormalizedWalletState) => A
): Atom.Atom<A> => selectAtom(walletConnectionStateAtom, select);

export const walletScopeAtom = selectCurrentWalletAtom(
  walletScopeFromState
).pipe(Atom.withLabel("walletScopeAtom"));
