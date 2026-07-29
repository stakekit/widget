import BigNumber from "bignumber.js";
import {
  buildCollateralToggleActionRequest,
  buildRepayActionRequest,
  buildWithdrawActionRequest,
} from "../../../domain/borrow/action-request";
import { decodeTokenId } from "../../../domain/borrow/ids";
import type { MarketPosition } from "../../../domain/borrow/market-position";
import { isDebtBelowMarketMinimum } from "../../../domain/borrow/minimum-debt";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";
import { getBorrowMarketPairLabel } from "./borrow-details-model";
import { makeBorrowRiskSummary } from "./borrow-risk-summary";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "./position-action-context";
import { deriveBorrowTokenWalletBalance } from "./wallet-balances";

export type BorrowPositionActionFormError =
  | "repayDebt"
  | "repayMinimum"
  | "walletBalance"
  | "withdrawBalance"
  | "withdrawLtv";

export type BorrowRepayFormIntent = {
  readonly amount: string;
  readonly repayAll: boolean;
};

export type BorrowRepayFormAction =
  | {
      readonly type: "amount/set";
      readonly amount: BigNumber | number | string;
    }
  | {
      readonly type: "repayAll/set";
      readonly repayAll: boolean;
    }
  | {
      readonly type: "reset";
    };

export type BorrowWithdrawFormIntent = {
  readonly amount: string;
  readonly selectedTokenAddress: string | null;
};

export type BorrowWithdrawFormAction =
  | {
      readonly type: "amount/set";
      readonly amount: BigNumber | number | string;
    }
  | {
      readonly type: "token/select";
      readonly tokenAddress: string;
    }
  | {
      readonly type: "reset";
    };

type BorrowRepayFormView = {
  readonly amount: BigNumber;
  readonly canSubmit: boolean;
  readonly currentLtv: number | null;
  readonly error: BorrowPositionActionFormError | null;
  readonly projectedLtv: number | null;
  readonly riskStatus: "available" | "unavailable";
  readonly remainingDebt: number;
  readonly repayAll: boolean;
  readonly repayUsd: BigNumber;
  readonly reviewState: BorrowTransactionFlowReview | null;
};

type BorrowWithdrawFormView = {
  readonly amount: BigNumber;
  readonly canSubmit: boolean;
  readonly currentCollateralUsd: number;
  readonly currentLtv: number | null;
  readonly error: BorrowPositionActionFormError | null;
  readonly projectedCollateralUsd: number;
  readonly projectedLtv: number | null;
  readonly riskStatus: "available" | "unavailable";
  readonly reviewState: BorrowTransactionFlowReview | null;
  readonly selectedToken: BorrowWithdrawTokenOption;
  readonly withdrawUsd: BigNumber;
};

const toAmountString = (amount: BigNumber | number | string) =>
  new BigNumber(amount).toString(10);

export const makeDefaultBorrowRepayFormIntent = (): BorrowRepayFormIntent => ({
  amount: "0",
  repayAll: false,
});

export const makeDefaultBorrowWithdrawFormIntent =
  (): BorrowWithdrawFormIntent => ({
    amount: "0",
    selectedTokenAddress: null,
  });

export const applyBorrowRepayFormAction = ({
  action,
  intent,
}: {
  readonly action: BorrowRepayFormAction;
  readonly intent: BorrowRepayFormIntent;
}): BorrowRepayFormIntent => {
  switch (action.type) {
    case "amount/set":
      return { ...intent, amount: toAmountString(action.amount) };
    case "repayAll/set":
      return { ...intent, repayAll: action.repayAll };
    case "reset":
      return makeDefaultBorrowRepayFormIntent();
  }
};

export const applyBorrowWithdrawFormAction = ({
  action,
  intent,
}: {
  readonly action: BorrowWithdrawFormAction;
  readonly intent: BorrowWithdrawFormIntent;
}): BorrowWithdrawFormIntent => {
  switch (action.type) {
    case "amount/set":
      return { ...intent, amount: toAmountString(action.amount) };
    case "token/select":
      return { amount: "0", selectedTokenAddress: action.tokenAddress };
    case "reset":
      return makeDefaultBorrowWithdrawFormIntent();
  }
};

const getPositionSummary = (position: MarketPosition) => ({
  marketLabel: getBorrowMarketPairLabel(position.market),
  network: position.market.network,
  providerName: position.integration.name,
});

export const resolveBorrowRepayFormView = ({
  address,
  context,
  intent,
  tokenBalances,
}: {
  readonly address: WalletAddress;
  readonly context: BorrowRepayActionContext;
  readonly intent: BorrowRepayFormIntent;
  readonly tokenBalances: ReadonlyArray<TokenBalance> | null;
}): BorrowRepayFormView => {
  const { debtBalance, position } = context;
  const amount = new BigNumber(intent.amount || 0);
  const repayAmount = intent.repayAll
    ? new BigNumber(debtBalance.balance)
    : amount;
  const walletBalance = deriveBorrowTokenWalletBalance({
    balances: tokenBalances ?? [],
    network: position.market.network,
    token: position.market.loanToken,
  });
  const exceedsDebt = repayAmount.gt(debtBalance.balance);
  const insufficientWalletBalance =
    !!tokenBalances && repayAmount.gt(walletBalance.amountValue);
  const repayUsd = repayAmount.multipliedBy(position.market.loanTokenPriceUsd);
  const remainingDebtAmount = BigNumber.maximum(
    new BigNumber(debtBalance.balance).minus(repayAmount),
    0
  );
  const minLoan = new BigNumber(position.market.minLoan ?? 0);
  const leavesDebtBelowMinimum = isDebtBelowMarketMinimum({
    debt: remainingDebtAmount,
    minimum: minLoan,
  });
  const riskAssessment = position.risk.assess([
    {
      amount: repayAmount.toNumber(),
      marketId: context.action.args.marketId,
      type: "repay",
    },
  ]);
  const riskProjection = riskAssessment.projection;
  const projectedDebtUsd =
    riskProjection.totalDebtUsd ??
    Math.max(position.metrics.totalBorrowedUsd - repayUsd.toNumber(), 0);
  const projectedLtv =
    riskProjection.status === "available" ? riskProjection.ltv : null;
  const riskSummary =
    riskProjection.status === "available"
      ? makeBorrowRiskSummary({
          healthFactor: riskProjection.healthFactor,
          ltv: riskProjection.ltv,
          status: riskProjection.status,
        })
      : makeBorrowRiskSummary({ status: riskProjection.status });
  const hasAmount = intent.repayAll || repayAmount.gt(0);
  const canSubmit =
    hasAmount &&
    !exceedsDebt &&
    !insufficientWalletBalance &&
    !leavesDebtBelowMinimum;
  const getError = (): BorrowPositionActionFormError | null => {
    if (exceedsDebt) return "repayDebt";
    if (insufficientWalletBalance) return "walletBalance";
    if (leavesDebtBelowMinimum) return "repayMinimum";
    return null;
  };

  return {
    amount,
    canSubmit,
    currentLtv:
      position.risk.current.status === "available"
        ? position.risk.current.ltv
        : null,
    error: getError(),
    projectedLtv,
    remainingDebt: remainingDebtAmount.toNumber(),
    repayAll: intent.repayAll,
    repayUsd,
    riskStatus: riskProjection.status,
    reviewState: canSubmit
      ? {
          request: buildRepayActionRequest({
            address,
            integrationId: position.integration.id,
            marketId: context.action.args.marketId,
            ...(intent.repayAll ? { repayAll: true } : { amount: repayAmount }),
            tokenAddress: context.action.args.tokenAddress,
          }),
          summary: {
            ...getPositionSummary(position),
            action: "repay",
            borrowAmount: repayAmount.toString(10),
            existingDebtUsd: debtBalance.balanceUsd.toString(),
            loanTokenSymbol: debtBalance.tokenSymbol,
            projectedDebtUsd: projectedDebtUsd.toString(),
            ...riskSummary,
          },
        }
      : null,
  };
};

const getSelectedWithdrawToken = ({
  context,
  intent,
}: {
  readonly context: BorrowWithdrawActionContext;
  readonly intent: BorrowWithdrawFormIntent;
}) => {
  if (intent.selectedTokenAddress === null) {
    return context.tokens[0] ?? null;
  }

  return (
    context.tokens.find(
      (token) => token.action.args.tokenAddress === intent.selectedTokenAddress
    ) ?? null
  );
};

export const resolveBorrowWithdrawFormView = ({
  address,
  context,
  intent,
}: {
  readonly address: WalletAddress;
  readonly context: BorrowWithdrawActionContext;
  readonly intent: BorrowWithdrawFormIntent;
}): BorrowWithdrawFormView | null => {
  const selectedToken = getSelectedWithdrawToken({ context, intent });

  if (!selectedToken) {
    return null;
  }

  const { position } = context;
  const amount = new BigNumber(intent.amount || 0);
  const withdrawUsd = amount.multipliedBy(
    selectedToken.collateralToken.priceUsd
  );
  const exceedsBalance = amount.gt(selectedToken.supplyBalance.balance);
  const currentCollateralUsd =
    position.risk.current.totalCollateralUsd ??
    position.metrics.totalCollateralUsd;
  const riskAssessment = position.risk.assess([
    {
      amount: amount.toNumber(),
      tokenId: decodeTokenId({
        address: selectedToken.collateralToken.token.address,
        symbol: selectedToken.collateralToken.token.symbol,
      }),
      type: "withdraw",
    },
  ]);
  const riskProjection = riskAssessment.projection;
  const projectedCollateralUsd =
    riskProjection.totalCollateralUsd ??
    Math.max(currentCollateralUsd - withdrawUsd.toNumber(), 0);
  const projectedLtv =
    riskProjection.status === "available" ? riskProjection.ltv : null;
  const riskSummary =
    riskProjection.status === "available"
      ? makeBorrowRiskSummary({
          healthFactor: riskProjection.healthFactor,
          ltv: riskProjection.ltv,
          status: riskProjection.status,
        })
      : makeBorrowRiskSummary({ status: riskProjection.status });
  const ltvTooHigh = amount.gt(0) && riskAssessment.decision === "block";
  const canSubmit = amount.gt(0) && !exceedsBalance && !ltvTooHigh;
  const getError = (): BorrowPositionActionFormError | null => {
    if (exceedsBalance) return "withdrawBalance";
    if (ltvTooHigh) return "withdrawLtv";
    return null;
  };

  return {
    amount,
    canSubmit,
    currentCollateralUsd,
    currentLtv:
      position.risk.current.status === "available"
        ? position.risk.current.ltv
        : null,
    error: getError(),
    projectedCollateralUsd,
    projectedLtv,
    riskStatus: riskProjection.status,
    reviewState: canSubmit
      ? {
          request: buildWithdrawActionRequest({
            address,
            amount,
            integrationId: position.integration.id,
            marketId: selectedToken.action.args.marketId,
            tokenAddress: selectedToken.action.args.tokenAddress,
          }),
          summary: {
            ...getPositionSummary(position),
            action: "withdraw",
            collateralAmount: amount.toString(10),
            collateralTokenSymbol: selectedToken.supplyBalance.tokenSymbol,
            existingCollateralUsd: currentCollateralUsd.toString(),
            projectedCollateralUsd: projectedCollateralUsd.toString(),
            ...riskSummary,
          },
        }
      : null,
    selectedToken,
    withdrawUsd,
  };
};

export const resolveBorrowCollateralToggleFormView = ({
  address,
  context,
}: {
  readonly address: WalletAddress;
  readonly context: BorrowCollateralToggleActionContext;
}): {
  readonly reviewState: BorrowTransactionFlowReview | null;
  readonly riskStatus: "available" | "unavailable";
} => {
  const { position } = context;
  const riskAssessment = position.risk.assess([
    {
      tokenId: decodeTokenId({
        address: context.action.args.tokenAddress,
        symbol: context.supplyBalance.tokenSymbol,
      }),
      type: context.type,
    },
  ]);
  const riskProjection = riskAssessment.projection;
  const riskSummary =
    riskProjection.status === "available"
      ? makeBorrowRiskSummary({
          healthFactor: riskProjection.healthFactor,
          ltv: riskProjection.ltv,
          status: riskProjection.status,
        })
      : makeBorrowRiskSummary({ status: riskProjection.status });

  if (riskAssessment.decision === "block") {
    return {
      reviewState: null,
      riskStatus: riskProjection.status,
    };
  }

  return {
    reviewState: {
      request: buildCollateralToggleActionRequest({
        action: context.type,
        address,
        integrationId: position.integration.id,
        marketId: context.action.args.marketId,
        tokenAddress: context.action.args.tokenAddress,
      }),
      summary: {
        ...getPositionSummary(position),
        action: context.type,
        collateralTokenSymbol: context.supplyBalance.tokenSymbol,
        existingCollateralUsd: (
          position.risk.current.totalCollateralUsd ??
          position.metrics.totalCollateralUsd
        ).toString(),
        ...riskSummary,
      },
    },
    riskStatus: riskProjection.status,
  };
};
