import BigNumber from "bignumber.js";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import { toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionBlockReason,
  BorrowActionPreparation,
  WithdrawDraft,
  WithdrawProjection,
} from "./types";

export const prepareWithdrawAction = (
  input: WithdrawDraft
): BorrowActionPreparation<WithdrawProjection> => {
  const { address, amount, context, token } = input;
  const { position } = context;
  const withdrawUsd = amount.multipliedBy(token.collateralToken.priceUsd);
  const currentCollateralUsd = new BigNumber(
    position.risk.current.totalCollateralUsd ??
      position.metrics.totalCollateralUsd
  );
  const assessment = position.risk.assess([
    {
      amount,
      tokenId: decodeTokenId({
        address: token.collateralToken.token.address,
        symbol: token.collateralToken.token.symbol,
      }),
      type: "withdraw",
    },
  ]);
  const projectedCollateralUsd = new BigNumber(
    assessment.projection.totalCollateralUsd ??
      BigNumber.maximum(currentCollateralUsd.minus(withdrawUsd), 0)
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: WithdrawProjection = {
    _tag: "Withdraw",
    amount,
    financials: {
      existingCollateralUsd: currentCollateralUsd,
      projectedCollateralUsd,
    },
    risk,
    withdrawUsd,
  };

  if (!amount.gt(0)) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (amount.gt(token.supplyBalance.balance)) {
    reasons.push("AmountExceedsPositionBalance");
  }
  if (assessment.decision === "block") {
    reasons.push("RiskCapacityExceeded");
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

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview({
      _tag: "Withdraw",
      address,
      amount,
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
    }),
  };
};
