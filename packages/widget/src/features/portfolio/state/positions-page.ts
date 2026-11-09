import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { walletStateResultAtom } from "../../wallet/index";
import {
  derivePositionsPageState,
  toWalletConnection,
} from "../model/positions-page";
import {
  currentGroupedPositionsAtom,
  currentPortfolioBorrowPositionsAtom,
  positionsViewAtom,
} from "./read-models/positions";

const walletConnectionAtom = Atom.make((get) =>
  toWalletConnection(
    get(walletStateResultAtom).pipe(
      AsyncResult.value,
      Option.map((wallet) => wallet.status),
      Option.getOrNull
    )
  )
).pipe(Atom.withLabel("portfolioWalletConnectionAtom"));

/**
 * Compact's positions page: it lists Earn positions only and keeps the last
 * loaded positions over a failed refetch without reporting it.
 */
export const earnPositionsPageAtom = Atom.make((get) => {
  const earn = get(positionsViewAtom);

  return derivePositionsPageState({
    connection: get(walletConnectionAtom),
    reportsPartialFailure: false,
    rows: earn._tag === "Ready" ? earn.value : [],
    sources: { borrow: null, earn },
  });
}).pipe(Atom.withLabel("earnPositionsPageAtom"));

/**
 * Dashboard's positions page: it lists Earn positions and, where Borrow is
 * active for the wallet, Borrow positions, and reports a source that failed.
 */
export const portfolioPositionsPageAtom = Atom.make((get) => {
  const borrow = get(currentPortfolioBorrowPositionsAtom);

  return derivePositionsPageState({
    connection: get(walletConnectionAtom),
    reportsPartialFailure: true,
    rows: get(currentGroupedPositionsAtom),
    sources: {
      borrow: borrow.connectionStatus === "connected" ? borrow.positions : null,
      earn: get(positionsViewAtom),
    },
  });
}).pipe(Atom.withLabel("portfolioPositionsPageAtom"));
