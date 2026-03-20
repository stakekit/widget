import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { PositionBalancesByType } from "../../../domain/types/positions";
import type { Prices } from "../../../domain/types/price";
import type { TokenString } from "../../../domain/types/tokens";
import type { usePrices } from "../../../hooks/api/use-prices";
import type { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";
import type { usePositionBalances } from "../../../hooks/use-position-balances";
import type { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import type {
  YieldBalanceType,
  YieldPendingActionType,
  YieldTokenDto,
} from "../../../providers/yield-api-client-provider/types";
import type { Action } from "../../../types/utils";

type UnstakeAmountChange = Action<"unstake/amount/change", BigNumber>;
type UnstakeAmountMax = Action<"unstake/amount/max">;

export type BalanceTokenActionType =
  `${YieldBalanceType}-${TokenString}-${YieldPendingActionType}`;

export type PendingActionAmountChange = Action<
  "pendingAction/amount/change",
  {
    balanceType: YieldBalanceType;
    token: TokenDto | YieldTokenDto;
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
  pendingActions: Map<BalanceTokenActionType, BigNumber>;
};

export type ExtraData = {
  pendingActionType: Maybe<YieldPendingActionType>;
  integrationData: Maybe<YieldDto>;
  positionBalances: ReturnType<typeof usePositionBalances>;
  yieldOpportunity: ReturnType<typeof useYieldOpportunity>;
  positionBalancesByType: Maybe<PositionBalancesByType>;
  stakedOrLiquidBalances: ReturnType<typeof useStakedOrLiquidBalance>;
  reducedStakedOrLiquidBalance: Maybe<{
    amount: BigNumber;
    amountUsd: BigNumber;
    token: TokenDto | YieldTokenDto;
  }>;
  positionBalancePrices: ReturnType<typeof usePrices<Prices>>;
  unstakeAmountValid: boolean;
  unstakeToken: Maybe<TokenDto | YieldTokenDto>;
  unstakeAmountError: boolean;
  canChangeUnstakeAmount: Maybe<boolean>;
  unstakeIsGreaterOrLessIntegrationLimitError: boolean;
  minUnstakeAmount: BigNumber;
};
