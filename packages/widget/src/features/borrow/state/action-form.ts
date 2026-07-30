import * as Atom from "effect/unstable/reactivity/Atom";
import type { MarketId } from "../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";

type BorrowActionFormState =
  | {
      readonly type: "idle";
    }
  | {
      readonly actionId: string;
      readonly marketId: MarketId;
      readonly network: BorrowNetwork;
      readonly scope: WalletScopeKey;
      readonly type: "positionAction";
    };

type BorrowActionFormAction =
  | {
      readonly actionId: string;
      readonly marketId: MarketId;
      readonly network: BorrowNetwork;
      readonly scope: WalletScopeKey;
      readonly type: "preparePositionAction";
    }
  | {
      readonly type: "reset";
    };

const defaultBorrowActionFormState: BorrowActionFormState = {
  type: "idle",
};

export const borrowActionFormAtom = Atom.writable<
  BorrowActionFormState,
  BorrowActionFormAction
>(
  () => defaultBorrowActionFormState,
  (context, action) => {
    switch (action.type) {
      case "preparePositionAction":
        context.setSelf({
          actionId: action.actionId,
          marketId: action.marketId,
          network: action.network,
          scope: action.scope,
          type: "positionAction",
        });
        return;
      case "reset":
        context.setSelf(defaultBorrowActionFormState);
        return;
    }
  }
);
