import BigNumber from "bignumber.js";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import { isDebtBelowMarketMinimum } from "../../../../domain/borrow/risk/minimum-debt";
import { makeOpenPositionFacts, toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionBlockReason,
  BorrowActionPreparation,
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
  const marketPosition =
    positions.items.find((position) => position.id === market.id) ?? null;
  const riskPosition = positions.riskFor(market);
  const walletBalances = deriveBorrowMarketWalletBalances({
    balances: tokenBalances,
    market,
    selectedCollateralTokenAddress: collateralToken.token.address,
  });
  const borrowMaxAmount = new BigNumber(market.availableLiquidity);
  const collateralMaxAmount =
    walletBalances.selectedCollateralToken?.amountValue ?? new BigNumber(0);
  const borrowUsd = borrowAmount.multipliedBy(market.loanTokenPriceUsd);
  const collateralUsd = collateralAmount.multipliedBy(collateralToken.priceUsd);
  const changes = [
    ...(borrowAmount.gt(0)
      ? [
          {
            amount: borrowAmount.toNumber(),
            marketId: market.id,
            type: "borrow" as const,
          },
        ]
      : []),
    ...(collateralAmount.gt(0)
      ? [
          {
            amount: collateralAmount.toNumber(),
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
  const existingCollateralUsd = new BigNumber(current.totalCollateralUsd ?? 0);
  const existingDebtUsd = new BigNumber(current.totalDebtUsd ?? 0);
  const projectedCollateralUsd = new BigNumber(
    assessment.projection.totalCollateralUsd ??
      existingCollateralUsd.plus(collateralUsd)
  );
  const projectedDebtUsd = new BigNumber(
    assessment.projection.totalDebtUsd ?? existingDebtUsd.plus(borrowUsd)
  );
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
  const hasBorrow = borrowAmount.gt(0);
  const hasCollateral = collateralAmount.gt(0);

  if (!hasBorrow && !hasCollateral) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (borrowAmount.gt(borrowMaxAmount)) {
    reasons.push("AmountExceedsAvailableLiquidity");
  }
  if (collateralAmount.gt(collateralMaxAmount)) {
    reasons.push("AmountExceedsWalletBalance");
  }
  if (assessment.decision === "block") {
    reasons.push("RiskCapacityExceeded");
  }
  const existingDebtAmount = new BigNumber(
    marketPosition?.balances.debt?.balance ?? 0
  );
  const projectedDebtAmount = existingDebtAmount.plus(borrowAmount);
  if (
    hasBorrow &&
    isDebtBelowMarketMinimum({
      debt: projectedDebtAmount,
      minimum: new BigNumber(market.minLoan ?? 0),
    })
  ) {
    reasons.push("ProjectedDebtBelowMarketMinimum");
  }

  if (reasons.length > 0) {
    return {
      _tag: "Blocked",
      projection,
      reasons: reasons as [
        BorrowActionBlockReason,
        ...BorrowActionBlockReason[],
      ],
    };
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
  } satisfies PreparedActionCommonFacts & OpenPositionFinancialFacts;
  const facts = makeOpenPositionFacts({
    borrowAmount,
    collateralAmount,
    collateralToken,
    common: commonFacts,
    market,
  });

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview(facts),
  };
};
