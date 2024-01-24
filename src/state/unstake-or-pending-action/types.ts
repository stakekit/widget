import BigNumber from "bignumber.js";
import { Action } from "../../types";
import { Maybe } from "purify-ts";
import {
  ActionDto,
  ActionTypes,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { usePositionBalances } from "../../hooks/use-position-balances";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { PositionBalancesByType } from "../../domain/types/positions";
import { useStakedOrLiquidBalance } from "../../hooks/use-staked-or-liquid-balance";
import { usePrices } from "../../hooks/api/use-prices";

export type UnstakeAmountChange = Action<"unstake/amount/change", BigNumber>;
export type UnstakeAmountMax = Action<"unstake/amount/max">;

export type PendingActionAmountChange = Action<
  "pendingAction/amount/change",
  { actionType: ActionTypes; amount: BigNumber }
>;

export type Reset = Action<"reset">;

export type Actions =
  | UnstakeAmountChange
  | UnstakeAmountMax
  | PendingActionAmountChange
  | Reset;

export type State = {
  unstakeAmount: BigNumber;
  pendingActions: Map<ActionTypes, BigNumber>;
};

export type ExtraData = {
  pendingActionType: Maybe<ActionTypes>;
  integrationData: Maybe<YieldDto>;
  stakeExitTxGas: Maybe<BigNumber>;
  pendingActionTxGas: Maybe<BigNumber>;
  unstakeSession: Maybe<ActionDto>;
  pendingActionSession: Maybe<ActionDto>;
  pendingActionToken: Maybe<TokenDto>;
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
};
