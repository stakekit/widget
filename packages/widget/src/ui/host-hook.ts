/**
 * The `data-rk` values hosts and tests locate elements by. A part that takes
 * `hostHook` renders it as `data-rk`; a new value joins this union.
 */
export type HostHook =
  | "account-modal-container"
  | "borrow-collateral-toggle__disableCollateral"
  | "borrow-collateral-toggle__enableCollateral"
  | "borrow-complete-page"
  | "borrow-position-action__repay"
  | "borrow-position-action__withdraw"
  | "borrow-steps-page"
  | "borrow-steps-retry"
  | "chain-modal"
  | "chain-modal-container"
  | "estimated-reward__monthly"
  | "estimated-reward__yearly"
  | "footer-button-primary"
  | "footer-button-secondary"
  | "header"
  | "page-container"
  | "tabs-section"
  | "widget-container";
