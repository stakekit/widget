import BigNumber from "bignumber.js";
import {
  buildCollateralToggleActionRequest,
  buildRepayActionRequest,
  buildWithdrawActionRequest,
} from "../../../domain/borrow/action-request";
import type { Position } from "../../../domain/borrow/position";
import { projectLtvRatio } from "../../../domain/borrow/position-projection";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { BorrowTransactionFlowReview } from "../../borrow-transaction-flow/state";
import { getBorrowMarketPairLabel } from "./borrow-details-model";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "./position-action-context";
import { deriveBorrowTokenWalletBalance } from "./wallet-balances";

export type BorrowPositionActionFormError =
  | "repayDebt"
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
  readonly projectedLtv: number;
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
  readonly projectedLtv: number;
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

const getPositionSummary = (position: Position) => ({
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
  const projectedDebtUsd = Math.max(
    debtBalance.balanceUsd - repayUsd.toNumber(),
    0
  );
  const projectedLtv = projectLtvRatio({
    collateralUsd: position.getTotalCollateralUsd(),
    debtUsd: projectedDebtUsd,
  });
  const collateralDetails = position.getCollateralTokenDetails();
  const projectedHealthFactor =
    projectedLtv > 0 && Number.isFinite(collateralDetails.liquidationThreshold)
      ? collateralDetails.liquidationThreshold / projectedLtv
      : null;
  const hasAmount = intent.repayAll || repayAmount.gt(0);
  const canSubmit = hasAmount && !exceedsDebt && !insufficientWalletBalance;
  const getError = (): BorrowPositionActionFormError | null => {
    if (exceedsDebt) return "repayDebt";
    if (insufficientWalletBalance) return "walletBalance";
    return null;
  };

  return {
    amount,
    canSubmit,
    currentLtv: position.getCurrentLtv(),
    error: getError(),
    projectedLtv,
    remainingDebt: Math.max(debtBalance.balance - repayAmount.toNumber(), 0),
    repayAll: intent.repayAll,
    repayUsd,
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
            projectedHealthFactor: projectedHealthFactor?.toString(),
            projectedLtv: projectedLtv.toString(),
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
}) =>
  context.tokens.find(
    (token) => token.action.args.tokenAddress === intent.selectedTokenAddress
  ) ??
  context.tokens[0] ??
  null;

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
  const currentCollateralUsd = position.getTotalCollateralUsd();
  const projectedCollateralUsd = Math.max(
    currentCollateralUsd - withdrawUsd.toNumber(),
    0
  );
  const projectedLtv = projectLtvRatio({
    collateralUsd: projectedCollateralUsd,
    debtUsd: position.getTotalBorrowedUsd(),
  });
  const ltvTooHigh =
    position.getTotalBorrowedUsd() > 0 &&
    amount.gt(0) &&
    projectedLtv > selectedToken.collateralToken.maxLtv;
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
    currentLtv: position.getCurrentLtv(),
    error: getError(),
    projectedCollateralUsd,
    projectedLtv,
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
            projectedLtv: projectedLtv.toString(),
          },
        }
      : null,
    selectedToken,
    withdrawUsd,
  };
};

export const resolveBorrowCollateralToggleReviewState = ({
  address,
  context,
}: {
  readonly address: WalletAddress;
  readonly context: BorrowCollateralToggleActionContext;
}): BorrowTransactionFlowReview => {
  const { position } = context;

  return {
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
      existingCollateralUsd: position.getTotalCollateralUsd().toString(),
      projectedHealthFactor: position.getHealthFactor()?.toString(),
      projectedLtv: position.getCurrentLtv()?.toString(),
    },
  };
};
