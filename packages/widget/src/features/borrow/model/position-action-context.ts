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

export type BorrowWithdrawTokenOption = {
  readonly action: WithdrawPendingAction;
  readonly collateralToken: CollateralToken;
  readonly supplyBalance: SupplyBalance;
};

export type BorrowRepayActionContext = {
  readonly action: RepayPendingAction;
  readonly debtBalance: DebtBalance;
  readonly position: Position;
  readonly type: "repay";
};

export type BorrowWithdrawActionContext = {
  readonly position: Position;
  readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
  readonly type: "withdraw";
};

export type BorrowCollateralToggleActionContext = {
  readonly action:
    | DisableCollateralPendingAction
    | EnableCollateralPendingAction;
  readonly position: Position;
  readonly supplyBalance: SupplyBalance;
  readonly type: "disableCollateral" | "enableCollateral";
};

export type BorrowPositionPendingActionContext =
  | BorrowRepayActionContext
  | BorrowWithdrawActionContext
  | BorrowCollateralToggleActionContext;
