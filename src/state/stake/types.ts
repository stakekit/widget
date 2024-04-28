import type {
  ActionDto,
  TokenBalanceScanResponseDto,
  TokenDto,
  TronResourceType,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { Action } from "../../types";

export type State = {
  selectedToken: Maybe<TokenBalanceScanResponseDto["token"]>;
  selectedStakeId: Maybe<
    TokenBalanceScanResponseDto["availableYields"][number]
  >;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  stakeAmount: BigNumber;
  tronResource: Maybe<TronResourceType>;
};

export type ExtraData = {
  stakeSession: Maybe<ActionDto>;
  stakeEnterTxGas: Maybe<BigNumber>;
  actions: { onMaxClick: () => void };
  selectedStake: Maybe<YieldDto>;
  isGasCheckError: boolean;
  stakeAmountLessThanMin: boolean;
  stakeAmountGreaterThanMax: boolean;
  stakeAmountGreaterThanAvailableAmount: boolean;
  stakeAmountIsZero: boolean;
  availableAmount: Maybe<BigNumber>;
  availableYields: Maybe<TokenBalanceScanResponseDto["availableYields"]>;
};

type TokenBalanceSelectAction = Action<"token/select", TokenDto>;
type YieldSelectAction = Action<"yield/select", YieldDto>;

type StakeAmountChangeAction = Action<"stakeAmount/change", BigNumber>;
type StakeAmountMaxAction = Action<"stakeAmount/max", BigNumber>;
type StateResetAction = Action<"state/reset">;

type ValidatorSelectAction = Action<"validator/select", ValidatorDto>;
type ValidatorMultiSelectAction = Action<"validator/multiselect", ValidatorDto>;
type ValidatorRemoveAction = Action<"validator/remove", ValidatorDto>;

type SelectTronResourceAction = Action<"tronResource/select", TronResourceType>;

export type Actions =
  | TokenBalanceSelectAction
  | YieldSelectAction
  | StakeAmountChangeAction
  | StakeAmountMaxAction
  | StateResetAction
  | ValidatorSelectAction
  | ValidatorMultiSelectAction
  | ValidatorRemoveAction
  | SelectTronResourceAction;
