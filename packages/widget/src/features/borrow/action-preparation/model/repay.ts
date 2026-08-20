import BigNumber from "bignumber.js";
import { getBorrowMarketPairLabel } from "../../../../domain/borrow/catalog/market";
import { isDebtBelowMarketMinimum } from "../../../../domain/borrow/risk/minimum-debt";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../../domain/finance/exact";
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
  const requestedAmount = repayAll
    ? debtBalance.balance
    : truncateToTokenDecimals(amount, position.market.loanToken.decimals);
  const effectiveAmount = requestedAmount;
  const walletBalance = deriveBorrowTokenWalletBalance({
    balances: tokenBalances ?? [],
    network: position.market.network,
    token: position.market.loanToken,
  });
  const repayUsd = effectiveAmount.multipliedBy(
    position.market.loanTokenPriceUsd
  );
  const remainingDebt = BigNumber.maximum(
    debtBalance.balance.minus(effectiveAmount),
    exactZero()
  );
  const assessment = position.risk.assess([
    {
      amount: effectiveAmount,
      marketId: action.args.marketId,
      type: "repay",
    },
  ]);
  const projectedDebtUsd = BigNumber.maximum(
    debtBalance.balanceUsd.minus(repayUsd),
    exactZero()
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
      existingDebtUsd: debtBalance.balanceUsd,
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
      minimum: position.market.minLoan ?? exactZero(),
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
    existingDebtUsd: debtBalance.balanceUsd,
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
