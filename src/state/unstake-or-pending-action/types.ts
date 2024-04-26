import type BigNumber from "bignumber.js";
import type { Action } from "../../types";
import type { Maybe } from "purify-ts";
import type {
  ActionDto,
  ActionTypes,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { usePositionBalances } from "../../hooks/use-position-balances";
import type { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import type { PositionBalancesByType } from "../../domain/types/positions";
import type { useStakedOrLiquidBalance } from "../../hooks/use-staked-or-liquid-balance";
import type { usePrices } from "../../hooks/api/use-prices";

type UnstakeAmountChange = Action<"unstake/amount/change", BigNumber>;
type UnstakeAmountMax = Action<"unstake/amount/max">;

type PendingActionAmountChange = Action<
  "pendingAction/amount/change",
  { actionType: ActionTypes; amount: BigNumber }
>;

type Reset = Action<"reset">;

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
  isGasCheckError: boolean;
  unstakeAmountValid: boolean;
  unstakeToken: Maybe<TokenDto>;
  unstakeAmountError: boolean;
};
