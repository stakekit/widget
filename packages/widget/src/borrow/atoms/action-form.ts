import * as Atom from "effect/unstable/reactivity/Atom";
import type { ActionsControllerExecuteActionV1RequestJson } from "../../generated/api/borrow";
import type {
  Action,
  CollateralToken,
  DebtBalance,
  DisableCollateralPendingAction,
  EnableCollateralPendingAction,
  Position,
  RepayPendingAction,
  SupplyBalance,
  WithdrawPendingAction,
} from "../domain";

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

export type BorrowActionFormReviewState = {
  readonly request: ActionsControllerExecuteActionV1RequestJson;
  readonly summary: {
    readonly action:
      | "borrow"
      | "borrowAndSupply"
      | "disableCollateral"
      | "enableCollateral"
      | "repay"
      | "supply"
      | "withdraw";
    readonly borrowAmount?: string;
    readonly collateralAmount?: string;
    readonly collateralTokenSymbol?: string;
    readonly existingCollateralUsd?: string;
    readonly existingDebtUsd?: string;
    readonly loanTokenSymbol?: string;
    readonly marketLabel: string;
    readonly network: string;
    readonly projectedCollateralUsd?: string;
    readonly projectedDebtUsd?: string;
    readonly projectedHealthFactor?: string;
    readonly projectedLtv?: string;
    readonly providerName: string;
  };
};

export type BorrowActionFormExecutionState = BorrowActionFormReviewState & {
  readonly action: Action;
};

export type BorrowActionFormState =
  | {
      readonly type: "idle";
    }
  | {
      readonly context: BorrowPositionPendingActionContext;
      readonly type: "positionAction";
    }
  | {
      readonly reviewState: BorrowActionFormReviewState;
      readonly type: "review";
    }
  | {
      readonly executionState: BorrowActionFormExecutionState;
      readonly type: "execution";
    };

export type BorrowActionFormAction =
  | {
      readonly context: BorrowPositionPendingActionContext;
      readonly type: "preparePositionAction";
    }
  | {
      readonly reviewState: BorrowActionFormReviewState;
      readonly type: "prepareReview";
    }
  | {
      readonly executionState: BorrowActionFormExecutionState;
      readonly type: "prepareExecution";
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
      case "prepareExecution":
        context.setSelf({
          executionState: action.executionState,
          type: "execution",
        });
        return;
      case "reset":
        context.setSelf(defaultBorrowActionFormState);
        return;
    }
  }
);
