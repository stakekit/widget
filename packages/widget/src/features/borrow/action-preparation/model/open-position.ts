import { decodeTokenId } from "../../../../domain/borrow/ids";
import { isDebtBelowMarketMinimum } from "../../../../domain/borrow/risk/minimum-debt";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../../domain/finance/exact";
import { makeOpenPositionFacts, toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionPreparation,
  BorrowConstraintWarning,
  OpenPositionDraft,
  OpenPositionFinancialFacts,
  OpenPositionProjection,
  PreparedActionCommonFacts,
} from "./types";
import { deriveBorrowMarketWalletBalances } from "./wallet-balances";

export const prepareOpenPositionAction = (
  input: OpenPositionDraft
): BorrowActionPreparation<OpenPositionProjection> => {
  const {
    address,
    borrowAmount,
    collateralAmount,
    collateralToken,
    integrations,
    market,
    positions,
    tokenBalances,
  } = input;
  const executableBorrowAmount = truncateToTokenDecimals(
    borrowAmount,
    market.loanToken.decimals
  );
  const executableCollateralAmount = truncateToTokenDecimals(
    collateralAmount,
    collateralToken.token.decimals
  );
  const marketPosition =
    positions.items.find((position) => position.id === market.id) ?? null;
  const riskPosition = positions.riskFor(market);
  const walletBalances = deriveBorrowMarketWalletBalances({
    balances: tokenBalances,
    market,
    selectedCollateralTokenId: decodeTokenId(collateralToken.token),
  });
  const borrowMaxAmount = market.availableLiquidity;
  const collateralMaxAmount =
    walletBalances.selectedCollateralToken?.amountValue ?? exactZero();
  const borrowUsd = executableBorrowAmount.multipliedBy(
    market.loanTokenPriceUsd
  );
  const collateralFeeAmount = truncateToTokenDecimals(
    executableCollateralAmount
      .multipliedBy(market.supplyCollateralFeeBps)
      .dividedBy(10_000),
    collateralToken.token.decimals
  );
  const effectiveCollateralAmount =
    executableCollateralAmount.minus(collateralFeeAmount);
  const collateralUsd = effectiveCollateralAmount.multipliedBy(
    collateralToken.priceUsd
  );
  const changes = [
    ...(executableBorrowAmount.gt(0)
      ? [
          {
            amount: executableBorrowAmount,
            marketId: market.id,
            type: "borrow" as const,
          },
        ]
      : []),
    ...(executableCollateralAmount.gt(0)
      ? [
          {
            amount: effectiveCollateralAmount,
            tokenId: decodeTokenId({
              address: collateralToken.token.address,
              symbol: collateralToken.token.symbol,
            }),
            type: "supply" as const,
          },
        ]
      : []),
  ];
  const assessment = riskPosition.assess(changes);
  const current = riskPosition.current;
  const existingCollateralUsd = current.totalCollateralUsd ?? exactZero();
  const existingDebtUsd = current.totalDebtUsd ?? exactZero();
  const projectedCollateralUsd =
    assessment.projection.totalCollateralUsd ??
    existingCollateralUsd.plus(collateralUsd);
  const projectedDebtUsd =
    assessment.projection.totalDebtUsd ?? existingDebtUsd.plus(borrowUsd);
  const risk = toBorrowRiskProjection({
    current,
    projected: assessment.projection,
  });
  const projection: OpenPositionProjection = {
    _tag: "OpenPosition",
    borrowMaxAmount,
    borrowUsd,
    collateralMaxAmount,
    collateralUsd,
    financials: {
      existingCollateralUsd,
      existingDebtUsd,
      projectedCollateralUsd,
      projectedDebtUsd,
    },
    risk,
  };
  const hasBorrow = executableBorrowAmount.gt(0);
  const hasCollateral = executableCollateralAmount.gt(0);

  if (!hasBorrow && !hasCollateral) {
    return { _tag: "Idle", projection };
  }

  const warnings: BorrowConstraintWarning[] = [];
  if (executableBorrowAmount.gt(borrowMaxAmount)) {
    warnings.push("AmountExceedsAvailableLiquidity");
  }
  if (executableCollateralAmount.gt(collateralMaxAmount)) {
    warnings.push("AmountExceedsWalletBalance");
  }
  if (assessment.decision === "block") {
    warnings.push("RiskCapacityExceeded");
  }
  const existingDebtAmount =
    marketPosition?.balances.debt?.balance ?? exactZero();
  const projectedDebtAmount = existingDebtAmount.plus(executableBorrowAmount);
  if (
    hasBorrow &&
    isDebtBelowMarketMinimum({
      debt: projectedDebtAmount,
      minimum: market.minLoan ?? exactZero(),
    })
  ) {
    warnings.push("ProjectedDebtBelowMarketMinimum");
  }

  const integration = integrations.find(
    (candidate) => candidate.id === market.integrationId
  );
  const commonFacts = {
    address,
    existingCollateralUsd,
    existingDebtUsd,
    integrationId: market.integrationId,
    marketId: market.id,
    marketLabel: `${collateralToken.token.symbol} / ${market.loanToken.symbol}`,
    network: market.network,
    projectedCollateralUsd,
    projectedDebtUsd,
    providerName: integration?.name ?? market.integrationId,
    risk,
    warnings,
  } satisfies PreparedActionCommonFacts & OpenPositionFinancialFacts;
  const facts = makeOpenPositionFacts({
    borrowAmount: executableBorrowAmount,
    collateralAmount: executableCollateralAmount,
    collateralFeeAmount,
    collateralToken,
    common: commonFacts,
    effectiveCollateralAmount,
    market,
  });

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview(facts),
    warnings,
  };
};
