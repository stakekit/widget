import * as Atom from "effect/reactivity/Atom";
import { selectAtom } from "../../../../shared/effect/select-atom";
import { walletConnectionStateAtom } from "../../../wallet/index";
import { widgetConfigAtom } from "../../../widget-configuration/index";
import { projectBorrowWalletView } from "../model/wallet-view";

const borrowWalletInputAtom = Atom.make((get) => ({
  initialChain: get(widgetConfigAtom).initialChain,
  wallet: get(walletConnectionStateAtom),
}));

export const currentBorrowWalletViewAtom = selectAtom(
  borrowWalletInputAtom,
  ({ initialChain, wallet }) => projectBorrowWalletView(wallet, initialChain)
).pipe(Atom.withLabel("currentBorrowWalletViewAtom"));
