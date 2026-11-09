import * as Atom from "effect/reactivity/Atom";

import { widgetConfigAtom } from "../../../../runtime/widget-config";
import { selectAtom } from "../../../../shared/effect/select-atom";
import { walletConnectionStateAtom } from "../../../wallet/index";
import { projectBorrowWalletView } from "../model/wallet-view";

const borrowWalletInputAtom = Atom.make((get) => ({
  initialChain: get(widgetConfigAtom).initialChain,
  wallet: get(walletConnectionStateAtom),
}));

export const currentBorrowWalletViewAtom = selectAtom(
  borrowWalletInputAtom,
  ({ initialChain, wallet }) => projectBorrowWalletView(wallet, initialChain)
).pipe(Atom.withLabel("currentBorrowWalletViewAtom"));
