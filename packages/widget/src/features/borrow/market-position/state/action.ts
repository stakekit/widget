import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { MarketId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import type { WalletScopeKey } from "../../../../services/wallet/domain/scope";
import { borrowTransactionFlowOutcomeAtom } from "../../../borrow-transaction-flow/state";
import {
  type BorrowFlowOutcomeCursor,
  initialBorrowFlowOutcomeCursor,
  resolveMarketPositionOutcomeReceipt,
} from "../../model/flow-outcome";

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

type BorrowActionFormStore = Readonly<{
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly state: BorrowActionFormState;
}>;

const defaultBorrowActionFormStore: BorrowActionFormStore = {
  cursor: initialBorrowFlowOutcomeCursor,
  state: defaultBorrowActionFormState,
};

const borrowActionFormStoreAtom = Atom.writable<
  BorrowActionFormStore,
  BorrowActionFormAction
>(
  (context) => {
    const previous = context
      .self<BorrowActionFormStore>()
      .pipe(Option.getOrElse(() => defaultBorrowActionFormStore));
    const receipt = context.get(borrowTransactionFlowOutcomeAtom).pipe(
      Option.map((outcome) => ({
        entry: outcome.entry,
        epoch: outcome.epoch,
        phase: outcome._tag,
      })),
      Option.getOrNull
    );
    if (previous.state.type !== "positionAction") return previous;

    const resolved = resolveMarketPositionOutcomeReceipt({
      cursor: previous.cursor,
      marketId: previous.state.marketId,
      receipt,
    });
    const state = resolved.reset
      ? defaultBorrowActionFormState
      : previous.state;
    return { cursor: resolved.cursor, state };
  },
  (context, action) => {
    const previous = context.get(borrowActionFormStoreAtom);
    switch (action.type) {
      case "preparePositionAction":
        context.setSelf({
          cursor: previous.cursor,
          state: {
            actionId: action.actionId,
            marketId: action.marketId,
            network: action.network,
            scope: action.scope,
            type: "positionAction",
          },
        });
        return;
      case "reset":
        context.setSelf({
          cursor: previous.cursor,
          state: defaultBorrowActionFormState,
        });
        return;
    }
  }
);

export const borrowActionFormAtom = Atom.writable<
  BorrowActionFormState,
  BorrowActionFormAction
>(
  (context) => context.get(borrowActionFormStoreAtom).state,
  (context, action) => context.set(borrowActionFormStoreAtom, action)
);
