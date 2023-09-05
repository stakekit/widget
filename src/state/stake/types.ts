import { ActionDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";

export type Action<T extends string, D = void> = D extends void
  ? { type: T }
  : { type: T; data: D };

export type State = {
  selectedStake: Maybe<YieldDto>;
  selectedValidator: Maybe<ValidatorDto>;
  stakeAmount: Maybe<BigNumber>;
};

export type ExtraData = {
  stakeSession: Maybe<ActionDto>;
  stakeEnterTxGas: Maybe<BigNumber>;
  actions: { onMaxClick: () => void };
};

type SelectedStakeAction = Action<"stake/select", YieldDto>;
type SelectedValidatorAction = Action<"validator/select", ValidatorDto>;
type StakeAmountChangeAction = Action<"stakeAmount/change", Maybe<BigNumber>>;
type StakeAmountMaxAction = Action<"stakeAmount/max", Maybe<BigNumber>>;
type StateResetAction = Action<"state/reset">;

export type Actions =
  | SelectedStakeAction
  | StakeAmountChangeAction
  | StakeAmountMaxAction
  | StateResetAction
  | SelectedValidatorAction;
