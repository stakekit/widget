import type { PositionBalancesByType } from "@sk-widget/domain/types/positions";
import type { Prices } from "@sk-widget/domain/types/price";
import type { TokenString } from "@sk-widget/domain/types/tokens";
import type { Action } from "@sk-widget/types/utils";
import type {
  ActionTypes,
  TokenDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { usePrices } from "../../../hooks/api/use-prices";
import type { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";
import type { usePositionBalances } from "../../../hooks/use-position-balances";
import type { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";

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
  positionBalancePrices: ReturnType<typeof usePrices<Prices>>;
  unstakeAmountValid: boolean;
  unstakeToken: Maybe<TokenDto>;
  unstakeAmountError: boolean;
  canChangeUnstakeAmount: Maybe<boolean>;
  unstakeIsGreaterOrLessIntegrationLimitError: boolean;
};
