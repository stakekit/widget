import BigNumber from "bignumber.js";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../../domain/finance/exact";
import { toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionPreparation,
  BorrowConstraintWarning,
  WithdrawDraft,
  WithdrawProjection,
} from "./types";

export const prepareWithdrawAction = (
  input: WithdrawDraft
): BorrowActionPreparation<WithdrawProjection> => {
  const { address, amount, context, token } = input;
  const { position } = context;
  const executableAmount = truncateToTokenDecimals(
    amount,
    token.collateralToken.token.decimals
  );
  const withdrawUsd = executableAmount.multipliedBy(
    token.collateralToken.priceUsd
  );
  const currentCollateralUsd =
    position.risk.current.totalCollateralUsd ??
    position.metrics.totalCollateralUsd;
  const assessment = position.risk.assess([
    {
      amount: executableAmount,
      tokenId: decodeTokenId({
        address: token.collateralToken.token.address,
        symbol: token.collateralToken.token.symbol,
      }),
      type: "withdraw",
    },
  ]);
  const projectedCollateralUsd =
    assessment.projection.totalCollateralUsd ??
    BigNumber.maximum(currentCollateralUsd.minus(withdrawUsd), exactZero());
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: WithdrawProjection = {
    _tag: "Withdraw",
    amount: executableAmount,
    financials: {
      existingCollateralUsd: currentCollateralUsd,
      projectedCollateralUsd,
    },
    risk,
    withdrawUsd,
  };

  if (!executableAmount.gt(0)) {
    return { _tag: "Idle", projection };
  }

  const warnings: BorrowConstraintWarning[] = [];
  if (executableAmount.gt(token.availableAmount)) {
    warnings.push("AmountExceedsPositionBalance");
  }
  if (assessment.decision === "block") {
    warnings.push("RiskCapacityExceeded");
  }

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview({
      _tag: "Withdraw",
      address,
      amount: executableAmount,
      collateralTokenAddress: token.action.args.tokenAddress,
      collateralTokenSymbol: token.supplyBalance.tokenSymbol,
      existingCollateralUsd: currentCollateralUsd,
      integrationId: position.integration.id,
      marketId: token.action.args.marketId,
      marketLabel: getBorrowMarketPairLabel(position.market),
      network: position.market.network,
      projectedCollateralUsd,
      providerName: position.integration.name,
      risk,
      warnings,
    }),
    warnings,
  };
};
