import * as Atom from "effect/unstable/reactivity/Atom";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import type {
  DisableCollateralPendingAction,
  EnableCollateralPendingAction,
  RepayPendingAction,
  WithdrawPendingAction,
} from "../../../domain/borrow/pending-action";
import type {
  DebtBalance,
  Position,
  SupplyBalance,
} from "../../../domain/borrow/position";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";

export type BorrowWithdrawTokenOption = {
  readonly action: WithdrawPendingAction;
  readonly collateralToken: CollateralToken;
  readonly supplyBalance: SupplyBalance;
};

export type BorrowPositionPendingActionContext =
  | {
      readonly action: RepayPendingAction;
      readonly debtBalance: DebtBalance;
      readonly position: Position;
      readonly type: "repay";
    }
  | {
      readonly position: Position;
      readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
      readonly type: "withdraw";
    }
  | {
      readonly action:
        | DisableCollateralPendingAction
        | EnableCollateralPendingAction;
      readonly position: Position;
      readonly supplyBalance: SupplyBalance;
      readonly type: "disableCollateral" | "enableCollateral";
    };

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
