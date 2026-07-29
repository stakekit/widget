import type {
  DebtBalance,
  SupplyBalance,
} from "../../../domain/borrow/borrow-account-snapshot";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import type { MarketPosition } from "../../../domain/borrow/market-position";
import type {
  DisableCollateralPendingAction,
  EnableCollateralPendingAction,
  RepayPendingAction,
  WithdrawPendingAction,
} from "../../../domain/borrow/pending-action";

export type BorrowWithdrawTokenOption = {
  readonly action: WithdrawPendingAction;
  readonly collateralToken: CollateralToken;
  readonly supplyBalance: SupplyBalance;
};

export type BorrowRepayActionContext = {
  readonly action: RepayPendingAction;
  readonly debtBalance: DebtBalance;
  readonly position: MarketPosition;
  readonly type: "repay";
};

export type BorrowWithdrawActionContext = {
  readonly position: MarketPosition;
  readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
  readonly type: "withdraw";
};

export type BorrowCollateralToggleActionContext = {
  readonly action:
    | DisableCollateralPendingAction
    | EnableCollateralPendingAction;
  readonly position: MarketPosition;
  readonly supplyBalance: SupplyBalance;
  readonly type: "disableCollateral" | "enableCollateral";
};

export type BorrowPositionPendingActionContext =
  | BorrowRepayActionContext
  | BorrowWithdrawActionContext
  | BorrowCollateralToggleActionContext;
