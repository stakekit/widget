import BigNumber from "bignumber.js";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import { toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionPreparation,
  CollateralToggleIntent,
  CollateralToggleProjection,
} from "./types";

export const prepareCollateralToggleAction = (
  input: CollateralToggleIntent
): BorrowActionPreparation<CollateralToggleProjection> => {
  const { address, context } = input;
  const { action, position, supplyBalance } = context;
  const assessment = position.risk.assess([
    {
      tokenId: decodeTokenId({
        address: action.args.tokenAddress,
        symbol: supplyBalance.tokenSymbol,
      }),
      type: context.type,
    },
  ]);
  const existingCollateralUsd = new BigNumber(
    position.risk.current.totalCollateralUsd ??
      position.metrics.totalCollateralUsd
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: CollateralToggleProjection = {
    _tag: "CollateralToggle",
    financials: { existingCollateralUsd },
    risk,
  };

  if (assessment.decision === "block") {
    return {
      _tag: "Blocked",
      projection,
      reasons: ["RiskCapacityExceeded"],
    };
  }

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview({
      _tag:
        context.type === "disableCollateral"
          ? "DisableCollateral"
          : "EnableCollateral",
      address,
      collateralTokenAddress: action.args.tokenAddress,
      collateralTokenSymbol: supplyBalance.tokenSymbol,
      existingCollateralUsd,
      integrationId: position.integration.id,
      marketId: action.args.marketId,
      marketLabel: getBorrowMarketPairLabel(position.market),
      network: position.market.network,
      providerName: position.integration.name,
      risk,
    }),
  };
};
