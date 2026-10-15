import type { YieldAction } from "../../../domain/action/models";
import type { Integration } from "../../../domain/borrow/catalog/integration";
import type { Market } from "../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../domain/borrow/catalog/token";
import type { ActionId as BorrowActionId } from "../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { BorrowActivityAction } from "../../../domain/borrow/responses";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ActionId } from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

export type YieldActivityItem = {
  readonly _tag: "yield";
  readonly actionData: YieldAction;
  readonly validatorsData: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yieldData: EarnYieldWithProvider | null;
};

/** Borrow rows open a Borrow receipt; continuation stays Yield-only. */
export type BorrowActivityItem = {
  readonly _tag: "borrow";
  readonly actionData: BorrowActivityAction;
  readonly integration: Integration | null;
  readonly market: Market | null;
  readonly network: BorrowNetwork;
  readonly token: BorrowToken | null;
  readonly walletScope: WalletScopeKey;
};

export type ActivityActionItem = YieldActivityItem | BorrowActivityItem;

/** Yield and Borrow ids come from different APIs, so a selection names both. */
export type ActivitySelectionTarget =
  | { readonly actionId: ActionId; readonly source: "yield" }
  | { readonly actionId: BorrowActionId; readonly source: "borrow" };

export const getActivitySelectionTarget = (
  item: ActivityActionItem
): ActivitySelectionTarget =>
  item._tag === "yield"
    ? { actionId: item.actionData.id, source: "yield" }
    : { actionId: item.actionData.id, source: "borrow" };

export const isActivitySelectionTarget = (
  item: ActivityActionItem,
  target: ActivitySelectionTarget | null
): boolean =>
  target !== null &&
  item._tag === target.source &&
  item.actionData.id === target.actionId;

export const getActivityActionPath = (target: ActivitySelectionTarget) =>
  target.source === "borrow"
    ? `/activity/borrow/${encodeURIComponent(target.actionId)}`
    : `/activity/${encodeURIComponent(target.actionId)}`;
