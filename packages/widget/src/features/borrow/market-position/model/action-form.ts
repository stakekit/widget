import type BigNumber from "bignumber.js";
import { exactDecimal } from "../../../../domain/finance/exact";
import type { TokenBalance } from "../../../../domain/finance/models";
import type { WalletAddress } from "../../../../domain/identity/identifiers";
import type {
  BorrowCollateralToggleActionContext,
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "../../action-preparation/index";
import {
  type BorrowActionPreparation,
  type BorrowConstraintWarning,
  type CollateralToggleProjection,
  prepareBorrowAction,
  type RepayProjection,
  type WithdrawProjection,
} from "../../action-preparation/index";

export type BorrowPositionActionFormWarning =
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
  readonly currentLtv: BigNumber | null;
  readonly warning: BorrowPositionActionFormWarning | null;
  readonly projectedLtv: BigNumber | null;
  readonly riskStatus: "available" | "unavailable";
  readonly remainingDebt: BigNumber;
  readonly repayAll: boolean;
  readonly repayUsd: BigNumber;
  readonly preparation: BorrowActionPreparation<RepayProjection>;
};

export type BorrowWithdrawFormView = {
  readonly amount: BigNumber;
  readonly canSubmit: boolean;
  readonly currentCollateralUsd: BigNumber;
  readonly currentLtv: BigNumber | null;
  readonly warning: BorrowPositionActionFormWarning | null;
  readonly projectedCollateralUsd: BigNumber;
  readonly projectedLtv: BigNumber | null;
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
  exactDecimal(amount).toString(10);

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
  const amount = exactDecimal(intent.amount || 0);
  const preparation = prepareBorrowAction({
    _tag: "RepayDraft",
    address,
    amount,
    context,
    repayAll: intent.repayAll,
    tokenBalances,
  });
  const { projection } = preparation;
  const warnings: ReadonlyArray<BorrowConstraintWarning> =
    preparation._tag === "Ready" ? preparation.warnings : [];
  const getWarning = (): BorrowPositionActionFormWarning | null => {
    if (warnings.includes("AmountExceedsPositionBalance")) return "repayDebt";
    if (warnings.includes("AmountExceedsWalletBalance")) return "walletBalance";
    if (warnings.includes("RemainingDebtBelowMarketMinimum")) {
      return "repayMinimum";
    }
    return null;
  };

  return {
    amount,
    canSubmit: preparation._tag === "Ready",
    currentLtv: projection.risk.currentLtv,
    preparation,
    projectedLtv:
      projection.risk.status === "available"
        ? projection.risk.projectedLtv
        : null,
    remainingDebt: projection.remainingDebt,
    repayAll: intent.repayAll,
    repayUsd: projection.repayUsd,
    riskStatus: projection.risk.status,
    warning: getWarning(),
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

  const amount = exactDecimal(intent.amount || 0);
  const preparation = prepareBorrowAction({
    _tag: "WithdrawDraft",
    address,
    amount,
    context,
    token: selectedToken,
  });
  const { projection } = preparation;
  const warnings: ReadonlyArray<BorrowConstraintWarning> =
    preparation._tag === "Ready" ? preparation.warnings : [];
  const getWarning = (): BorrowPositionActionFormWarning | null => {
    if (warnings.includes("AmountExceedsPositionBalance")) {
      return "withdrawBalance";
    }
    if (warnings.includes("RiskCapacityExceeded")) return "withdrawLtv";
    return null;
  };

  return {
    amount,
    canSubmit: preparation._tag === "Ready",
    currentCollateralUsd: projection.financials.existingCollateralUsd,
    currentLtv: projection.risk.currentLtv,
    preparation,
    projectedCollateralUsd: projection.financials.projectedCollateralUsd,
    projectedLtv:
      projection.risk.status === "available"
        ? projection.risk.projectedLtv
        : null,
    riskStatus: projection.risk.status,
    selectedToken,
    warning: getWarning(),
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
