import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { toBorrowWalletStateProjection } from "../../../services/borrow/wallet-state-projection";
import { disconnectedNormalizedWalletState } from "../../../services/wallet/domain/state";
import { currentWalletStateResultAtom } from "../../wallet/state/root-atom";

export const disconnectedBorrowWalletProjection = toBorrowWalletStateProjection(
  disconnectedNormalizedWalletState
);

export const currentBorrowWalletStateAtom = Atom.make(
  (get) =>
    get
      .result(currentWalletStateResultAtom)
      .pipe(Effect.map(toBorrowWalletStateProjection)),
  { initialValue: disconnectedBorrowWalletProjection }
).pipe(Atom.setIdleTTL(0), Atom.withLabel("currentBorrowWalletStateAtom"));
