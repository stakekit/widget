import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../app/runtime/widget-config";
import { toBorrowWalletStateProjection } from "../../../../services/borrow/wallet-state-projection";
import { disconnectedNormalizedWalletState } from "../../../../services/wallet/wallet-state";
import { walletStateResultAtom } from "../../../wallet/state";

export const disconnectedBorrowWalletProjection = toBorrowWalletStateProjection(
  disconnectedNormalizedWalletState
);

export const currentBorrowWalletStateAtom = Atom.make(
  (get) => {
    if (!get(widgetConfigAtom).borrowEnabled) {
      return Effect.succeed(disconnectedBorrowWalletProjection);
    }

    return get
      .result(walletStateResultAtom)
      .pipe(Effect.map(toBorrowWalletStateProjection));
  },
  { initialValue: disconnectedBorrowWalletProjection }
).pipe(Atom.withLabel("currentBorrowWalletStateAtom"));
