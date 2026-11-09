import { Equal, Ref, Schema } from "effect";

import type { Action } from "../../../domain/borrow/action";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import { ActionId, type MarketId } from "../../../domain/borrow/ids";
import type { Integration } from "../../../domain/borrow/integration";
import type { Market } from "../../../domain/borrow/market";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  type WidgetFlowDestination,
  type WidgetPath,
  widgetBorrowFlowRoutes,
  widgetRoutes,
} from "../../../services/navigation/widget-routes";
import type { BorrowTransactionFlowReview } from "./review";

/**
 * What the Borrow Entry details pane described when the flow started. The
 * flow's details pane keeps describing this market even if the catalog later
 * drops it or the entry form resets its selection.
 */
export type BorrowEntryFlowDetails = {
  readonly collateralToken: CollateralToken | null;
  readonly integration: Integration | null;
  readonly market: Market;
};

export type BorrowTransactionFlowEntry =
  | { readonly _tag: "BorrowEntry"; readonly details: BorrowEntryFlowDetails }
  | { readonly _tag: "MarketPosition"; readonly marketId: MarketId };

export type BorrowTransactionFlowIntake = BorrowTransactionFlowReview & {
  readonly entry: BorrowTransactionFlowEntry;
};

/**
 * The action Review created and handed off: waiting for Steps to start it,
 * then running until its Execution ends.
 */
export type BorrowFlowHandoff = Readonly<{
  readonly _tag: "Running" | "Waiting";
  readonly action: Action;
}>;

/**
 * A started Flow Session: its immutable input and its handoff, if any. Start
 * hands it to the flow route through Review navigation state; the route that
 * mounts it owns its lifetime.
 */
export class BorrowFlowSession {
  readonly handoff = Ref.makeUnsafe<BorrowFlowHandoff | null>(null);
  readonly intake: BorrowTransactionFlowIntake;
  readonly walletScope: WalletScopeKey;

  constructor(input: {
    readonly intake: BorrowTransactionFlowIntake;
    readonly walletScope: WalletScopeKey;
  }) {
    this.intake = input.intake;
    this.walletScope = input.walletScope;
    // Each Start is its own Session, even with an equal intake: Atom family
    // keys compare it by identity.
    Equal.byReferenceUnsafe(this);
  }
}

const BorrowFlowNavigationState = Schema.Struct({
  borrowFlowSession: Schema.instanceOf(BorrowFlowSession),
  /** On Steps and Complete: the handed-off action their Execution runs. */
  executionActionId: Schema.optional(ActionId),
});

type BorrowFlowNavigationState = typeof BorrowFlowNavigationState.Type;

/**
 * Each entry's Review, Steps, and Complete routes, carrying the Session (and
 * on Steps and Complete, the handed-off action) in their navigation state.
 */
export const borrowFlowRoutes = {
  BorrowEntry: widgetBorrowFlowRoutes.BorrowEntry.withState(
    BorrowFlowNavigationState
  ),
  MarketPosition: widgetBorrowFlowRoutes.MarketPosition.withState(
    BorrowFlowNavigationState
  ),
} as const satisfies Record<BorrowTransactionFlowEntry["_tag"], unknown>;

export const getBorrowReviewTrackingProperties = (
  intake: BorrowTransactionFlowIntake
) => {
  if (intake.entry._tag !== "BorrowEntry") return null;
  const { command, summary } = intake;
  return {
    borrowAmount: "borrowAmount" in summary ? summary.borrowAmount : "0",
    collateralAmount:
      "collateralAmount" in summary ? summary.collateralAmount : "0",
    collateralTokenAddress: command.args.collateralTokenAddress,
    collateralTokenSymbol:
      "collateralTokenSymbol" in summary
        ? summary.collateralTokenSymbol
        : undefined,
    marketId: command.args.marketId,
  };
};

/**
 * The flow pages an entry mounts, and its base: the page the flow starts from
 * and leaves to. Only the Dashboard Layout mounts Borrow.
 */
export const getBorrowTransactionFlowDestination = (
  entry: BorrowTransactionFlowEntry
): WidgetFlowDestination<BorrowFlowNavigationState> &
  Readonly<{ readonly basePath: WidgetPath }> =>
  entry._tag === "BorrowEntry"
    ? {
        ...borrowFlowRoutes.BorrowEntry.at("Dashboard"),
        basePath: widgetRoutes.borrow.build("Dashboard"),
      }
    : {
        ...borrowFlowRoutes.MarketPosition.at("Dashboard", {
          marketId: entry.marketId,
        }),
        basePath: widgetRoutes.borrowPosition.build("Dashboard", {
          marketId: entry.marketId,
        }),
      };
