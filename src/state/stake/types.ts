import {
  ActionDto,
  TokenBalanceScanResponseDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { Action } from "../../types";

export type State = {
  selectedTokenBalance: Maybe<TokenBalanceScanResponseDto>;
  selectedStakeId: Maybe<
    TokenBalanceScanResponseDto["availableYields"][number]
  >;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  stakeAmount: Maybe<BigNumber>;
};

export type ExtraData = {
  stakeSession: Maybe<ActionDto>;
  stakeEnterTxGas: Maybe<BigNumber>;
  actions: { onMaxClick: () => void };
  selectedStake: Maybe<YieldDto>;
};

type TokenBalanceSelectAction = Action<
  "tokenBalance/select",
  { tokenBalance: TokenBalanceScanResponseDto; initYield: Maybe<YieldDto> }
>;
type YieldSelectAction = Action<"yield/select", YieldDto>;

type StakeAmountChangeAction = Action<"stakeAmount/change", Maybe<BigNumber>>;
type StakeAmountMaxAction = Action<"stakeAmount/max", Maybe<BigNumber>>;
type StateResetAction = Action<"state/reset">;

type ValidatorSelectAction = Action<"validator/select", ValidatorDto>;
type ValidatorMultiSelectAction = Action<"validator/multiselect", ValidatorDto>;
type ValidatorRemoveAction = Action<"validator/remove", ValidatorDto>;

export type Actions =
  | TokenBalanceSelectAction
  | YieldSelectAction
  | StakeAmountChangeAction
  | StakeAmountMaxAction
  | StateResetAction
  | ValidatorSelectAction
  | ValidatorMultiSelectAction
  | ValidatorRemoveAction;
