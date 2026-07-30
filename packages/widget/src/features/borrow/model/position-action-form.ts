import BigNumber from "bignumber.js";
import type { TokenBalance } from "../../../domain/schema/financial-models";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import {
  type BorrowActionBlockReason,
  type BorrowActionPreparation,
  type CollateralToggleProjection,
  prepareBorrowAction,
  type RepayProjection,
  type WithdrawProjection,
} from "./action-preparation";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "./position-action-context";

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

export type BorrowRepayFormView = {
  readonly amount: BigNumber;
  readonly canSubmit: boolean;
  readonly currentLtv: number | null;
  readonly error: BorrowPositionActionFormError | null;
  readonly projectedLtv: number | null;
  readonly riskStatus: "available" | "unavailable";
  readonly remainingDebt: number;
  readonly repayAll: boolean;
  readonly repayUsd: BigNumber;
  readonly preparation: BorrowActionPreparation<RepayProjection>;
};

export type BorrowWithdrawFormView = {
  readonly amount: BigNumber;
  readonly canSubmit: boolean;
  readonly currentCollateralUsd: number;
  readonly currentLtv: number | null;
  readonly error: BorrowPositionActionFormError | null;
  readonly projectedCollateralUsd: number;
  readonly projectedLtv: number | null;
  readonly riskStatus: "available" | "unavailable";
  readonly preparation: BorrowActionPreparation<WithdrawProjection>;
  readonly selectedToken: BorrowWithdrawTokenOption;
  readonly withdrawUsd: BigNumber;
};

export type BorrowCollateralToggleFormView = {
  readonly preparation: BorrowActionPreparation<CollateralToggleProjection>;
  readonly riskStatus: "available" | "unavailable";
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
  const amount = new BigNumber(intent.amount || 0);
  const preparation = prepareBorrowAction({
    _tag: "RepayDraft",
    address,
    amount,
    context,
    repayAll: intent.repayAll,
    tokenBalances,
  });
  const { projection } = preparation;
  const reasons: ReadonlyArray<BorrowActionBlockReason> =
    preparation._tag === "Blocked" ? preparation.reasons : [];
  const getError = (): BorrowPositionActionFormError | null => {
    if (reasons.includes("AmountExceedsPositionBalance")) return "repayDebt";
    if (reasons.includes("AmountExceedsWalletBalance")) return "walletBalance";
    if (reasons.includes("RemainingDebtBelowMarketMinimum")) {
      return "repayMinimum";
    }
    return null;
  };

  return {
    amount,
    canSubmit: preparation._tag === "Ready",
    currentLtv: projection.risk.currentLtv,
    error: getError(),
    preparation,
    projectedLtv:
      projection.risk.status === "available"
        ? projection.risk.projectedLtv
        : null,
    remainingDebt: projection.remainingDebt.toNumber(),
    repayAll: intent.repayAll,
    repayUsd: projection.repayUsd,
    riskStatus: projection.risk.status,
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

  const amount = new BigNumber(intent.amount || 0);
  const preparation = prepareBorrowAction({
    _tag: "WithdrawDraft",
    address,
    amount,
    context,
    token: selectedToken,
  });
  const { projection } = preparation;
  const reasons: ReadonlyArray<BorrowActionBlockReason> =
    preparation._tag === "Blocked" ? preparation.reasons : [];
  const getError = (): BorrowPositionActionFormError | null => {
    if (reasons.includes("AmountExceedsPositionBalance")) {
      return "withdrawBalance";
    }
    if (reasons.includes("RiskCapacityExceeded")) return "withdrawLtv";
    return null;
  };

  return {
    amount,
    canSubmit: preparation._tag === "Ready",
    currentCollateralUsd:
      projection.financials.existingCollateralUsd.toNumber(),
    currentLtv: projection.risk.currentLtv,
    error: getError(),
    preparation,
    projectedCollateralUsd:
      projection.financials.projectedCollateralUsd.toNumber(),
    projectedLtv:
      projection.risk.status === "available"
        ? projection.risk.projectedLtv
        : null,
    riskStatus: projection.risk.status,
    selectedToken,
    withdrawUsd: projection.withdrawUsd,
  };
};

export const resolveBorrowCollateralToggleFormView = ({
  address,
  context,
}: {
  readonly address: WalletAddress;
  readonly context: BorrowCollateralToggleActionContext;
}): BorrowCollateralToggleFormView => {
  const preparation = prepareBorrowAction({
    _tag: "CollateralToggleIntent",
    address,
    context,
  });

  return {
    preparation,
    riskStatus: preparation.projection.risk.status,
  };
};
