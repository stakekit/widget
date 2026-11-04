import { Equal, Ref, Schema } from "effect";
import type { CollateralToken } from "../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../domain/borrow/catalog/integration";
import type { Market } from "../../../domain/borrow/catalog/market";
import type {
  Action,
  ActionMetadata,
} from "../../../domain/borrow/execution/action";
import type { ActionCommand } from "../../../domain/borrow/execution/action-command";
import { ActionId, type MarketId } from "../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type {
  RiskGateBlockReason,
  RiskGateVerdict,
  RiskGateWarning,
} from "../../../domain/borrow/risk/risk-gate";
import { exactDecimal } from "../../../domain/finance/exact";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  type WidgetFlowDestination,
  type WidgetPath,
  widgetBorrowFlowRoutes,
  widgetRoutes,
} from "../../../services/navigation/widget-routes";

export type BorrowConstraintWarning =
  | "AmountExceedsAvailableLiquidity"
  | "AmountExceedsPositionBalance"
  | "AmountExceedsWalletBalance"
  | "ProjectedDebtBelowMarketMinimum"
  | "RemainingDebtBelowMarketMinimum"
  | RiskGateWarning;

type BorrowReviewCommon = {
  readonly marketLabel: string;
  readonly network: BorrowNetwork;
  readonly providerName: string;
  readonly warnings: ReadonlyArray<BorrowConstraintWarning>;
};

type AvailableBorrowReviewRisk = {
  readonly currentHealthFactor?: string;
  readonly currentLtv?: string;
  readonly maxLtv?: string;
  readonly projectedHealthFactor?: string;
  readonly projectedLtv: string;
  readonly riskStatus: "available";
};

type UnavailableBorrowReviewRisk = {
  readonly riskStatus: "unavailable";
};

type BorrowReviewRisk = AvailableBorrowReviewRisk | UnavailableBorrowReviewRisk;

type OpenPositionReviewFinancials = {
  readonly existingCollateralUsd: string;
  readonly existingDebtUsd: string;
  readonly projectedCollateralUsd: string;
  readonly projectedDebtUsd: string;
};

/** The requested borrow is net; debt opens at the gross principal. */
type BorrowReviewOrigination = {
  readonly debtPrincipalAmount: string;
  readonly loanTokenPriceUsd: string;
  readonly originationFeeAmount: string;
};

type BorrowTransactionFlowSummary = BorrowReviewCommon &
  BorrowReviewRisk &
  (
    | (OpenPositionReviewFinancials &
        BorrowReviewOrigination & {
          readonly action: "borrow";
          readonly borrowAmount: string;
          readonly loanTokenSymbol: string;
        })
    | (OpenPositionReviewFinancials &
        BorrowReviewOrigination & {
          readonly action: "borrowAndSupply";
          readonly borrowAmount: string;
          readonly collateralAmount: string;
          readonly collateralFeeAmount: string;
          readonly collateralTokenSymbol: string;
          readonly effectiveCollateralAmount: string;
          readonly loanTokenSymbol: string;
        })
    | (OpenPositionReviewFinancials & {
        readonly action: "supply";
        readonly collateralAmount: string;
        readonly collateralFeeAmount: string;
        readonly collateralTokenSymbol: string;
        readonly effectiveCollateralAmount: string;
      })
    | {
        readonly action: "repay";
        readonly borrowAmount: string;
        readonly existingDebtUsd: string;
        readonly loanTokenSymbol: string;
        readonly projectedDebtUsd: string;
      }
    | {
        readonly action: "withdraw";
        readonly collateralAmount: string;
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: string;
        readonly projectedCollateralUsd: string;
      }
    | {
        readonly action: "disableCollateral" | "enableCollateral";
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: string;
      }
  );

export type BorrowTransactionFlowReview = {
  readonly command: ActionCommand;
  /** The Risk Gate's verdict at preparation; Review never re-derives it. */
  readonly riskVerdict: RiskGateVerdict;
  readonly summary: BorrowTransactionFlowSummary;
};

export const getBorrowTransactionFlowAmountLabelKey = (
  action: BorrowTransactionFlowSummary["action"]
) =>
  action === "repay"
    ? ("dashboard.borrow.review_page.repay_amount" as const)
    : ("dashboard.borrow.review_page.borrow_amount" as const);

/** The asset an action is about: the loan for debt actions, else collateral. */
export const getBorrowTransactionFlowTitle = (
  summary: BorrowTransactionFlowSummary
) => {
  switch (summary.action) {
    case "borrow":
    case "borrowAndSupply":
    case "repay":
      return {
        key: `dashboard.borrow.review_page.titles.${summary.action}`,
        symbol: summary.loanTokenSymbol,
      } as const;
    case "supply":
    case "withdraw":
    case "disableCollateral":
    case "enableCollateral":
      return {
        key: `dashboard.borrow.review_page.titles.${summary.action}`,
        symbol: summary.collateralTokenSymbol,
      } as const;
  }
};

/**
 * The limit Review refuses to confirm past: the Risk Gate's Block verdict
 * carried from preparation. Review never re-derives it from display figures.
 */
export const getBorrowReviewRiskBlock = (
  review: BorrowTransactionFlowReview
): RiskGateBlockReason | null =>
  review.riskVerdict._tag === "Block" ? review.riskVerdict.reason : null;

const projectOrigination = (
  summary: BorrowReviewOrigination & { readonly loanTokenSymbol: string },
  metadata: ActionMetadata | undefined
) => {
  const feeAmount =
    metadata?.originationFeeAmount ??
    exactDecimal(summary.originationFeeAmount);
  if (!feeAmount.isGreaterThan(0)) return null;

  const loanTokenPriceUsd = exactDecimal(summary.loanTokenPriceUsd);
  const principalAmount =
    metadata?.effectivePrincipalAmount ??
    exactDecimal(summary.debtPrincipalAmount);

  return {
    feeAmount: feeAmount.toString(10),
    feeUsd: loanTokenPriceUsd.isGreaterThan(0)
      ? feeAmount.multipliedBy(loanTokenPriceUsd).toString(10)
      : null,
    principalAmount: principalAmount.toString(10),
    symbol: summary.loanTokenSymbol,
  };
};

const projectCollateralFee = (
  summary: {
    readonly collateralAmount: string;
    readonly collateralFeeAmount: string;
    readonly effectiveCollateralAmount: string;
  },
  metadata: ActionMetadata | undefined
) => {
  const feeAmount = metadata?.feeAmount;
  const effectiveAmount =
    metadata?.effectiveCollateralAmount ??
    (feeAmount === undefined
      ? undefined
      : exactDecimal(summary.collateralAmount).minus(feeAmount));

  return {
    effectiveAmount:
      effectiveAmount?.toString(10) ?? summary.effectiveCollateralAmount,
    feeAmount: feeAmount?.toString(10) ?? summary.collateralFeeAmount,
  };
};

type ProjectedAmount = {
  readonly amount: string;
  readonly symbol: string;
};

/** Review's summary in display form: amounts, fees, financials, and risk. */
export type ProjectedBorrowTransactionFlowSummary = {
  readonly borrow: ProjectedAmount | null;
  readonly collateral:
    | ProjectedAmount
    | (ProjectedAmount & {
        readonly effectiveAmount: string;
        readonly feeAmount: string;
      })
    | null;
  readonly financials: {
    readonly existingCollateralUsd: string | null;
    readonly existingDebtUsd: string | null;
    readonly projectedCollateralUsd: string | null;
    readonly projectedDebtUsd: string | null;
  };
  readonly origination: {
    readonly feeAmount: string;
    readonly feeUsd: string | null;
    readonly principalAmount: string;
    readonly symbol: string;
  } | null;
  readonly risk: {
    readonly currentHealthFactor: string | null;
    readonly currentLtv: string | null;
    readonly maxLtv: string | null;
    readonly projectedHealthFactor: string | null;
    readonly projectedLtv: string | null;
    readonly status: BorrowTransactionFlowSummary["riskStatus"];
  };
};

/**
 * Projects the review summary for display. Fee figures the created action
 * reports win over the widget's pre-creation estimate.
 */
export const projectBorrowTransactionFlowSummary = (
  summary: BorrowTransactionFlowSummary,
  metadata?: ActionMetadata
): ProjectedBorrowTransactionFlowSummary => {
  const risk =
    summary.riskStatus === "available"
      ? {
          currentHealthFactor: summary.currentHealthFactor ?? null,
          currentLtv: summary.currentLtv ?? null,
          maxLtv: summary.maxLtv ?? null,
          projectedHealthFactor: summary.projectedHealthFactor ?? null,
          projectedLtv: summary.projectedLtv,
          status: summary.riskStatus,
        }
      : {
          currentHealthFactor: null,
          currentLtv: null,
          maxLtv: null,
          projectedHealthFactor: null,
          projectedLtv: null,
          status: summary.riskStatus,
        };

  switch (summary.action) {
    case "borrow":
    case "borrowAndSupply":
    case "supply":
      return {
        borrow:
          summary.action === "supply"
            ? null
            : {
                amount: summary.borrowAmount,
                symbol: summary.loanTokenSymbol,
              },
        collateral:
          summary.action === "borrow"
            ? null
            : {
                ...projectCollateralFee(summary, metadata),
                amount: summary.collateralAmount,
                symbol: summary.collateralTokenSymbol,
              },
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        origination:
          summary.action === "supply"
            ? null
            : projectOrigination(summary, metadata),
        risk,
      };
    case "repay":
      return {
        borrow: {
          amount: summary.borrowAmount,
          symbol: summary.loanTokenSymbol,
        },
        collateral: null,
        financials: {
          existingCollateralUsd: null,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: null,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        origination: null,
        risk,
      };
    case "withdraw":
      return {
        borrow: null,
        collateral: {
          amount: summary.collateralAmount,
          symbol: summary.collateralTokenSymbol,
        },
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: null,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: null,
        },
        origination: null,
        risk,
      };
    case "disableCollateral":
    case "enableCollateral":
      return {
        borrow: null,
        collateral: null,
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: null,
          projectedCollateralUsd: null,
          projectedDebtUsd: null,
        },
        origination: null,
        risk,
      };
  }
};

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
