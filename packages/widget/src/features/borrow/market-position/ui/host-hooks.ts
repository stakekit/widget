import type { HostHook } from "../../../../ui/index";
import type { BorrowPositionAction } from "../model/details";

/** Where hosts find each position action: its button or collateral switch. */
export const borrowPositionActionHostHooks = {
  disableCollateral: "borrow-collateral-toggle__disableCollateral",
  enableCollateral: "borrow-collateral-toggle__enableCollateral",
  repay: "borrow-position-action__repay",
  withdraw: "borrow-position-action__withdraw",
} as const satisfies Record<BorrowPositionAction["type"], HostHook>;
