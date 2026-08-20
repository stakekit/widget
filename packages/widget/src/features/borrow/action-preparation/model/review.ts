import type BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Market } from "../../../../domain/borrow/catalog/market";
import type { TokenAddress } from "../../../../domain/borrow/ids";
import type { BorrowTransactionFlowReview } from "../../../borrow-transaction-flow/index";
import type {
  BorrowRiskProjection,
  OpenPositionFinancialFacts,
  PreparedActionCommonFacts,
  PreparedActionFacts,
} from "./types";

export const makeOpenPositionFacts = ({
  borrowAmount,
  collateralAmount,
  collateralFeeAmount,
  collateralToken,
  common,
  effectiveCollateralAmount,
  market,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly collateralFeeAmount: BigNumber;
  readonly collateralToken: CollateralToken;
  readonly common: PreparedActionCommonFacts & OpenPositionFinancialFacts;
  readonly effectiveCollateralAmount: BigNumber;
  readonly market: Market;
}): PreparedActionFacts => {
  if (borrowAmount.gt(0) && collateralAmount.gt(0)) {
    return {
      ...common,
      _tag: "BorrowAndSupply",
      borrowAmount,
      collateralAmount,
      collateralFeeAmount,
      collateralTokenAddress: collateralToken.token.address,
      collateralTokenSymbol: collateralToken.token.symbol,
      effectiveCollateralAmount,
      loanTokenAddress: market.loanToken.address,
      loanTokenSymbol: market.loanToken.symbol,
    };
  }

  if (borrowAmount.gt(0)) {
    return {
      ...common,
      _tag: "Borrow",
      amount: borrowAmount,
      loanTokenAddress: market.loanToken.address,
      loanTokenSymbol: market.loanToken.symbol,
    };
  }

  return {
    ...common,
    _tag: "Supply",
    amount: collateralAmount,
    collateralFeeAmount,
    collateralTokenAddress: collateralToken.token.address,
    collateralTokenSymbol: collateralToken.token.symbol,
    effectiveCollateralAmount,
  };
};

const optionalTokenAddress = (tokenAddress: TokenAddress | undefined) =>
  tokenAddress ? { tokenAddress } : {};

const optionalCollateralTokenAddress = (
  collateralTokenAddress: TokenAddress | undefined
) => (collateralTokenAddress ? { collateralTokenAddress } : {});

const getRiskSummary = (
  risk: BorrowRiskProjection
):
  | {
      readonly projectedHealthFactor?: string;
      readonly projectedLtv: string;
      readonly riskStatus: "available";
    }
  | { readonly riskStatus: "unavailable" } => {
  if (risk.status === "unavailable") {
    return { riskStatus: risk.status };
  }

  return {
    ...(risk.projectedHealthFactor == null
      ? {}
      : { projectedHealthFactor: risk.projectedHealthFactor.toString() }),
    projectedLtv: risk.projectedLtv.toString(),
    riskStatus: risk.status,
  };
};

export const toBorrowTransactionFlowReview = (
  facts: PreparedActionFacts
): BorrowTransactionFlowReview => {
  const commonSummary = {
    marketLabel: facts.marketLabel,
    network: facts.network,
    providerName: facts.providerName,
    warnings: facts.warnings,
    ...getRiskSummary(facts.risk),
  };

  switch (facts._tag) {
    case "Borrow":
      return {
        command: {
          action: "borrow",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.loanTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "borrow",
          borrowAmount: facts.amount.toString(10),
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "BorrowAndSupply":
      return {
        command: {
          action: "borrow",
          address: facts.address,
          args: {
            amount: facts.borrowAmount.toString(10),
            collateralAmount: facts.collateralAmount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.loanTokenAddress),
            ...optionalCollateralTokenAddress(facts.collateralTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "borrowAndSupply",
          borrowAmount: facts.borrowAmount.toString(10),
          collateralAmount: facts.collateralAmount.toString(10),
          collateralFeeAmount: facts.collateralFeeAmount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          effectiveCollateralAmount:
            facts.effectiveCollateralAmount.toString(10),
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Supply":
      return {
        command: {
          action: "supply",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            ...optionalTokenAddress(facts.collateralTokenAddress),
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "supply",
          collateralAmount: facts.amount.toString(10),
          collateralFeeAmount: facts.collateralFeeAmount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          effectiveCollateralAmount:
            facts.effectiveCollateralAmount.toString(10),
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Repay":
      return {
        command: {
          action: "repay",
          address: facts.address,
          args: {
            marketId: facts.marketId,
            ...(facts.repayAll
              ? { repayAll: true as const }
              : { amount: facts.amount.toString(10) }),
            tokenAddress: facts.loanTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "repay",
          borrowAmount: facts.amount.toString(10),
          existingDebtUsd: facts.existingDebtUsd.toString(10),
          loanTokenSymbol: facts.loanTokenSymbol,
          projectedDebtUsd: facts.projectedDebtUsd.toString(10),
        },
      };
    case "Withdraw":
      return {
        command: {
          action: "withdraw",
          address: facts.address,
          args: {
            amount: facts.amount.toString(10),
            marketId: facts.marketId,
            tokenAddress: facts.collateralTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action: "withdraw",
          collateralAmount: facts.amount.toString(10),
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
          projectedCollateralUsd: facts.projectedCollateralUsd.toString(10),
        },
      };
    case "DisableCollateral":
    case "EnableCollateral": {
      const action =
        facts._tag === "DisableCollateral"
          ? ("disableCollateral" as const)
          : ("enableCollateral" as const);

      return {
        command: {
          action,
          address: facts.address,
          args: {
            marketId: facts.marketId,
            tokenAddress: facts.collateralTokenAddress,
          },
          integrationId: facts.integrationId,
        },
        summary: {
          ...commonSummary,
          action,
          collateralTokenSymbol: facts.collateralTokenSymbol,
          existingCollateralUsd: facts.existingCollateralUsd.toString(10),
        },
      };
    }
  }
};
