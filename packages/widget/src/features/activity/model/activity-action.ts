import type { YieldAction } from "../../../domain/action/models";
import type { BorrowToken } from "../../../domain/borrow/catalog/token";
import type { BorrowActivityAction } from "../../../domain/borrow/responses";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

export type YieldActivityItem = {
  readonly _tag: "yield";
  readonly actionData: YieldAction;
  readonly validatorsData: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yieldData: EarnYieldWithProvider | null;
};

/** Borrow rows are list-only: details and continuation stay Yield-only. */
export type BorrowActivityItem = {
  readonly _tag: "borrow";
  readonly actionData: BorrowActivityAction;
  readonly token: BorrowToken | null;
  readonly walletScope: WalletScopeKey;
};

export type ActivityActionItem = YieldActivityItem | BorrowActivityItem;
