import type {
  ActionTypes,
  TokenDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { TokenString } from "../../../domain/types";
import type { PositionBalancesByType } from "../../../domain/types/positions";
import type { usePrices } from "../../../hooks/api/use-prices";
import type { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";
import type { usePositionBalances } from "../../../hooks/use-position-balances";
import type { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import type { Action } from "../../../types";

type UnstakeAmountChange = Action<"unstake/amount/change", BigNumber>;
type UnstakeAmountMax = Action<"unstake/amount/max">;

export type BalanceTokenActionType =
  `${YieldBalanceDto["type"]}-${TokenString}-${ActionTypes}`;

export type PendingActionAmountChange = Action<
  "pendingAction/amount/change",
  {
    balanceType: YieldBalanceDto["type"];
    token: TokenDto;
    actionType: ActionTypes;
    amount: BigNumber;
  }
>;

export type Actions =
  | UnstakeAmountChange
  | UnstakeAmountMax
  | PendingActionAmountChange;

export type State = {
  unstakeAmount: BigNumber;
  pendingActions: Map<BalanceTokenActionType, BigNumber>;
};

export type ExtraData = {
  pendingActionType: Maybe<ActionTypes>;
  integrationData: Maybe<YieldDto>;
  positionBalances: ReturnType<typeof usePositionBalances>;
  yieldOpportunity: ReturnType<typeof useYieldOpportunity>;
  positionBalancesByType: Maybe<PositionBalancesByType>;
  stakedOrLiquidBalances: ReturnType<typeof useStakedOrLiquidBalance>;
  reducedStakedOrLiquidBalance: Maybe<{
    amount: BigNumber;
    token: TokenDto;
    pricePerShare: string;
  }>;
  positionBalancePrices: ReturnType<typeof usePrices>;
  unstakeAmountValid: boolean;
  unstakeToken: Maybe<TokenDto>;
  unstakeAmountError: boolean;
  canChangeUnstakeAmount: Maybe<boolean>;
};
