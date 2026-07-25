import * as Atom from "effect/unstable/reactivity/Atom";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";
import type { BorrowPositionPendingActionContext } from "../model/position-action-context";

type BorrowActionFormState =
  | {
      readonly type: "idle";
    }
  | {
      readonly context: BorrowPositionPendingActionContext;
      readonly type: "positionAction";
    }
  | {
      readonly reviewState: BorrowTransactionFlowReview;
      readonly type: "review";
    };

type BorrowActionFormAction =
  | {
      readonly context: BorrowPositionPendingActionContext;
      readonly type: "preparePositionAction";
    }
  | {
      readonly reviewState: BorrowTransactionFlowReview;
      readonly type: "prepareReview";
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
          context: action.context,
          type: "positionAction",
        });
        return;
      case "prepareReview":
        context.setSelf({
          reviewState: action.reviewState,
          type: "review",
        });
        return;
      case "reset":
        context.setSelf(defaultBorrowActionFormState);
        return;
    }
  }
);
