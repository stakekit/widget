import BigNumber from "bignumber.js";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import { isDebtBelowMarketMinimum } from "../../../../domain/borrow/risk/minimum-debt";
import { toBorrowTransactionFlowReview } from "./review";
import { toBorrowRiskProjection } from "./risk-projection";
import type {
  BorrowActionBlockReason,
  BorrowActionPreparation,
  PreparedActionFacts,
  RepayDraft,
  RepayProjection,
} from "./types";
import { deriveBorrowTokenWalletBalance } from "./wallet-balances";

export const prepareRepayAction = (
  input: RepayDraft
): BorrowActionPreparation<RepayProjection> => {
  const { address, amount, context, repayAll, tokenBalances } = input;
  const { action, debtBalance, position } = context;
  const effectiveAmount = repayAll
    ? new BigNumber(debtBalance.balance)
    : amount;
  const walletBalance = deriveBorrowTokenWalletBalance({
    balances: tokenBalances ?? [],
    network: position.market.network,
    token: position.market.loanToken,
  });
  const repayUsd = effectiveAmount.multipliedBy(
    position.market.loanTokenPriceUsd
  );
  const remainingDebt = BigNumber.maximum(
    new BigNumber(debtBalance.balance).minus(effectiveAmount),
    0
  );
  const assessment = position.risk.assess([
    {
      amount: effectiveAmount.toNumber(),
      marketId: action.args.marketId,
      type: "repay",
    },
  ]);
  const projectedDebtUsd = new BigNumber(
    assessment.projection.totalDebtUsd ??
      Math.max(position.metrics.totalBorrowedUsd - repayUsd.toNumber(), 0)
  );
  const risk = toBorrowRiskProjection({
    current: position.risk.current,
    projected: assessment.projection,
  });
  const projection: RepayProjection = {
    _tag: "Repay",
    amount,
    effectiveAmount,
    financials: {
      existingDebtUsd: new BigNumber(debtBalance.balanceUsd),
      projectedDebtUsd,
    },
    remainingDebt,
    repayAll,
    repayUsd,
    risk,
  };

  if (!repayAll && !effectiveAmount.gt(0)) {
    return { _tag: "Idle", projection };
  }

  const reasons: BorrowActionBlockReason[] = [];
  if (effectiveAmount.gt(debtBalance.balance)) {
    reasons.push("AmountExceedsPositionBalance");
  }
  if (tokenBalances && effectiveAmount.gt(walletBalance.amountValue)) {
    reasons.push("AmountExceedsWalletBalance");
  }
  if (
    isDebtBelowMarketMinimum({
      debt: remainingDebt,
      minimum: new BigNumber(position.market.minLoan ?? 0),
    })
  ) {
    reasons.push("RemainingDebtBelowMarketMinimum");
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

  const facts: PreparedActionFacts = {
    _tag: "Repay",
    address,
    amount: effectiveAmount,
    existingDebtUsd: new BigNumber(debtBalance.balanceUsd),
    integrationId: position.integration.id,
    loanTokenAddress: action.args.tokenAddress,
    loanTokenSymbol: debtBalance.tokenSymbol,
    marketId: action.args.marketId,
    marketLabel: getBorrowMarketPairLabel(position.market),
    network: position.market.network,
    projectedDebtUsd,
    providerName: position.integration.name,
    repayAll,
    risk,
  };

  return {
    _tag: "Ready",
    projection,
    review: toBorrowTransactionFlowReview(facts),
  };
};
