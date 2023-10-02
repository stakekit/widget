import {
  ActionDto,
  TokenBalanceScanResponseDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";

export type Action<T extends string, D = void> = D extends void
  ? { type: T }
  : { type: T; data: D };

export type State = {
  selectedTokenBalance: Maybe<TokenBalanceScanResponseDto>;
  selectedStakeId: Maybe<
    TokenBalanceScanResponseDto["availableYields"][number]
  >;
  selectedValidator: Maybe<ValidatorDto>;
  stakeAmount: Maybe<BigNumber>;
};

export type ExtraData = {
  stakeSession: Maybe<ActionDto>;
  stakeEnterTxGas: Maybe<BigNumber>;
  actions: { onMaxClick: () => void };
  selectedStake: Maybe<YieldDto>;
};

type SelectedTokenAction = Action<
  "tokenBalance/select",
  { tokenBalance: TokenBalanceScanResponseDto; initYield: Maybe<YieldDto> }
>;
type SelectedStakeAction = Action<"yield/select", YieldDto>;
type SelectedValidatorAction = Action<"validator/select", ValidatorDto>;
type StakeAmountChangeAction = Action<"stakeAmount/change", Maybe<BigNumber>>;
type StakeAmountMaxAction = Action<"stakeAmount/max", Maybe<BigNumber>>;
type StateResetAction = Action<"state/reset">;

export type Actions =
  | SelectedTokenAction
  | SelectedStakeAction
  | StakeAmountChangeAction
  | StakeAmountMaxAction
  | StateResetAction
  | SelectedValidatorAction;
