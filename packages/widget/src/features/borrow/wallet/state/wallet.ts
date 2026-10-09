import * as Atom from "effect/reactivity/Atom";
import { selectCurrentWalletAtom } from "../../../wallet/index";
import { projectBorrowWalletView } from "../model/wallet-view";

export const currentBorrowWalletViewAtom = selectCurrentWalletAtom(
  projectBorrowWalletView
).pipe(Atom.withLabel("currentBorrowWalletViewAtom"));
