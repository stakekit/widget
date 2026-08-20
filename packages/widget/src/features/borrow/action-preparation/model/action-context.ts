import type BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type {
  DebtBalance,
  SupplyBalance,
} from "../../../../domain/borrow/positions/borrow-account-snapshot";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import type {
  DisableCollateralPendingAction,
  EnableCollateralPendingAction,
  RepayPendingAction,
  WithdrawPendingAction,
} from "../../../../domain/borrow/positions/pending-action";

export type BorrowWithdrawTokenOption = {
  readonly action: WithdrawPendingAction;
  readonly availableAmount: BigNumber;
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
