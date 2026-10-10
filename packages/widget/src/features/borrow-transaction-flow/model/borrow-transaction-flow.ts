import { Data, Option, Schema } from "effect";
import type { ActionMetadata } from "../../../domain/borrow/execution/action";
import type { ActionCommand } from "../../../domain/borrow/execution/action-command";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import { exactDecimal } from "../../../domain/finance/exact";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  toWidgetPath,
  type WidgetPathInput,
} from "../../../services/navigation/widget-navigation";

export type BorrowConstraintWarning =
  | "AmountExceedsAvailableLiquidity"
  | "AmountExceedsPositionBalance"
  | "AmountExceedsWalletBalance"
  | "ProjectedDebtBelowMarketMinimum"
  | "RemainingDebtBelowMarketMinimum"
  | "RiskCapacityExceeded";

type BorrowReviewCommon = {
  readonly marketLabel: string;
  readonly network: BorrowNetwork;
  readonly providerName: string;
  readonly warnings: ReadonlyArray<BorrowConstraintWarning>;
};

type AvailableBorrowReviewRisk = {
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
  readonly summary: BorrowTransactionFlowSummary;
};

export const getBorrowTransactionFlowAmountLabelKey = (
  action: BorrowTransactionFlowSummary["action"]
) =>
  action === "repay"
    ? ("dashboard.borrow.review_page.repay_amount" as const)
    : ("dashboard.borrow.review_page.borrow_amount" as const);

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

/**
 * Projects the review summary for display. Fee figures the created action
 * reports win over the widget's pre-creation estimate.
 */
export const projectBorrowTransactionFlowSummary = (
  summary: BorrowTransactionFlowSummary,
  metadata?: ActionMetadata
) => {
  const risk =
    summary.riskStatus === "available"
      ? {
          projectedHealthFactor: summary.projectedHealthFactor ?? null,
          projectedLtv: summary.projectedLtv,
          status: summary.riskStatus,
        }
      : {
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

export type BorrowTransactionFlowEntry =
  | { readonly _tag: "BorrowEntry" }
  | { readonly _tag: "MarketPosition"; readonly marketId: string };

export type BorrowTransactionFlowIntake = BorrowTransactionFlowReview & {
  readonly entry: BorrowTransactionFlowEntry;
};

/**
 * A started Flow Session's immutable input. Start hands it to the flow route
 * through Review navigation state; the route that mounts it owns its lifetime.
 */
export class BorrowFlowSession extends Data.Class<{
  readonly intake: BorrowTransactionFlowIntake;
  readonly walletScope: WalletScopeKey;
}> {}

const BorrowFlowNavigationState = Schema.Struct({
  borrowFlowSession: Schema.instanceOf(BorrowFlowSession),
});

export const makeBorrowFlowNavigationState = (
  session: BorrowFlowSession
): typeof BorrowFlowNavigationState.Type => ({ borrowFlowSession: session });

export const decodeBorrowFlowNavigationState = (
  state: unknown
): Option.Option<BorrowFlowSession> =>
  Schema.decodeUnknownOption(BorrowFlowNavigationState)(state).pipe(
    Option.map((decoded) => decoded.borrowFlowSession)
  );

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

export const getBorrowTransactionFlowRoutes = (
  entry: BorrowTransactionFlowEntry
) => {
  const basePath: WidgetPathInput =
    entry._tag === "BorrowEntry"
      ? "/borrow"
      : `/positions/borrow/${entry.marketId}`;

  return {
    basePath: toWidgetPath(basePath),
    completePath: toWidgetPath(`${basePath}/complete`),
    reviewPath: toWidgetPath(`${basePath}/review`),
    stepsPath: toWidgetPath(`${basePath}/steps`),
  } as const;
};
