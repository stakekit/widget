import type { YieldCategory } from "../../../domain/earn/contract";

/** The translation key of a Dashboard tab a flow's breadcrumb starts from. */
type TransactionFlowTrailParent =
  | "tabs.activity"
  | "tabs.borrow"
  | "tabs.earn"
  | "tabs.manage"
  | `tabs.${YieldCategory}`;

/**
 * Where a flow sits, as the composition that mounts it names it: `parent`
 * is the tab its breadcrumb starts from, such as Earn.
 */
export type TransactionFlowTrail = Readonly<{
  readonly parent: TransactionFlowTrailParent;
}>;
