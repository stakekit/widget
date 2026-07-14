import { Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../providers/wallet/state/wallet";
import {
  type BorrowWalletStateProjection,
  toBorrowWalletStateProjection,
} from "./bridge";

export const disconnectedBorrowWalletProjection: BorrowWalletStateProjection =
  toBorrowWalletStateProjection(disconnectedNormalizedWalletState);

export const makeBorrowWalletStateAtom = <WalletStateError>(
  walletStateAtom: Atom.Atom<
    AsyncResult.AsyncResult<NormalizedWalletState, WalletStateError>
  >
): Atom.Atom<
  AsyncResult.AsyncResult<BorrowWalletStateProjection, WalletStateError>
> =>
  Atom.make(
    (get) =>
      get
        .result(walletStateAtom)
        .pipe(Effect.map(toBorrowWalletStateProjection)),
    { initialValue: disconnectedBorrowWalletProjection }
  ).pipe(Atom.setIdleTTL(0));
