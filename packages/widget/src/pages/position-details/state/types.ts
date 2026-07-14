import type BigNumber from "bignumber.js";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import type {
  PositionBalances,
  PositionBalancesByType,
  YieldBalanceType,
} from "../../../domain/types/positions";
import type { TokenString } from "../../../domain/types/tokens";

import type { positionBalancesAtom } from "../../../hooks/api/position-atoms";
import type { pricesAtom } from "../../../hooks/api/prices-atoms";
import type { yieldOpportunityAtom } from "../../../hooks/api/yield-atoms";
import type { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import type { Action } from "../../../types/utils";

type UnstakeAmountChange = Action<"unstake/amount/change", BigNumber>;
type UnstakeAmountMax = Action<"unstake/amount/max">;

export type BalanceTokenActionType =
  `${YieldBalanceType}-${TokenString}-${YieldPendingActionType}`;

export type PendingActionAmountChange = Action<
  "pendingAction/amount/change",
  {
    balanceType: YieldBalanceType;
    token: AppToken;
    actionType: YieldPendingActionType;
    amount: BigNumber;
  }
>;

export type Actions =
  | UnstakeAmountChange
  | UnstakeAmountMax
  | PendingActionAmountChange;

export type State = {
  unstakeAmount: BigNumber;
  unstakeUseMaxAmount: boolean;
  pendingActions: Map<BalanceTokenActionType, BigNumber>;
};

export type ExtraData = {
  pendingActionType: YieldPendingActionType | null;
  integrationData: EarnYieldWithProvider | null;
  positionBalances: PositionBalances | null;
  positionBalancesResult: Atom.Type<ReturnType<typeof positionBalancesAtom>>;
  yieldOpportunity: Atom.Type<ReturnType<typeof yieldOpportunityAtom>>;
  positionBalancesByType: PositionBalancesByType | null;
  stakedOrLiquidBalances: ReturnType<typeof useStakedOrLiquidBalance>;
  reducedStakedOrLiquidBalance: {
    amount: BigNumber;
    amountUsd: BigNumber;
    token: AppToken;
  } | null;
  positionBalancePrices: Atom.Type<ReturnType<typeof pricesAtom>>;
  unstakeAmountValid: boolean;
  unstakeToken: AppToken | null;
  unstakeAmountError: boolean;
  canChangeUnstakeAmount: boolean | null;
  unstakeIsGreaterOrLessIntegrationLimitError: boolean;
  minUnstakeAmount: BigNumber;
};
