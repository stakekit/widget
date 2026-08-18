import * as Atom from "effect/unstable/reactivity/Atom";
import { selectCurrentWalletAtom } from "../../../wallet/state";
import { projectBorrowWalletView } from "../model/wallet-view";

export const currentBorrowWalletViewAtom = selectCurrentWalletAtom(
  projectBorrowWalletView
).pipe(Atom.withLabel("currentBorrowWalletViewAtom"));
