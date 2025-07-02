import type {
  TokenBalanceScanResponseDto,
  TokenDto,
  TronResourceType,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import type { useProvidersDetails } from "../../../../hooks/use-provider-details";
import type { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import type { Action } from "../../../../types/utils";
import type { SelectedStakeData } from "../types";

export type State = {
  selectedToken: Maybe<TokenBalanceScanResponseDto["token"]>;
  selectedStakeId: Maybe<
    TokenBalanceScanResponseDto["availableYields"][number]
  >;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  stakeAmount: BigNumber;
  tronResource: Maybe<TronResourceType>;
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

export type ExtraData = {
  actions: { onMaxClick: () => void };
  selectedStake: Maybe<YieldDto>;
  stakeAmountLessThanMin: boolean;
  stakeAmountGreaterThanMax: boolean;
  stakeAmountGreaterThanAvailableAmount: boolean;
  stakeAmountIsZero: boolean;
  availableAmount: Maybe<BigNumber>;
  availableYields: Maybe<TokenBalanceScanResponseDto["availableYields"]>;
  hasNotYieldsForToken: boolean;
};

export type EarnPageContextType = {
  selectedTokenAvailableAmount: Maybe<{
    symbol: string;
    shortFormattedAmount: string;
    fullFormattedAmount: string;
    amount: BigNumber;
  }>;
  formattedPrice: string;
  symbol: string;
  selectedStakeData: Maybe<SelectedStakeData>;
  selectedStake: ExtraData["selectedStake"];
  onYieldSelect: (yieldId: string) => void;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
  onStakeAmountChange: (value: BigNumber) => void;
  estimatedRewards: ReturnType<typeof useEstimatedRewards>;
  yieldType: string;
  onMaxClick: () => void;
  stakeAmount: State["stakeAmount"];
  isFetching: boolean;
  buttonDisabled: boolean;
  onClick: () => void;
  onYieldSearch: (value: string) => void;
  onValidatorSelect: (item: ValidatorDto) => void;
  onValidatorRemove: (item: ValidatorDto) => void;
  selectedValidators: State["selectedValidators"];
  isError: boolean;
  rewardToken: ReturnType<typeof useRewardTokenDetails>;
  onSelectOpportunityClose: () => void;
  onSelectTokenClose: () => void;
  isConnected: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  appLoading: boolean;
  yieldOpportunityLoading: boolean;
  tokenBalancesScanLoading: boolean;
  selectedToken: State["selectedToken"];
  tokenBalancesData: Maybe<{
    all: TokenBalanceScanResponseDto[];
    filtered: TokenBalanceScanResponseDto[];
  }>;
  onTokenSearch: (value: string) => void;
  onValidatorSearch: (value: string) => void;
  validatorSearch: string;
  buttonCTAText: string;
  providersDetails: ReturnType<typeof useProvidersDetails>;
  tokenSearch: string;
  stakeSearch: string;
  defaultTokensIsLoading: boolean;
  tronResource: State["tronResource"];
  onTronResourceSelect: (value: TronResourceType) => void;
  validation: {
    submitted: boolean;
    hasErrors: boolean;
    errors: {
      tronResource: boolean;
      stakeAmountGreaterThanAvailableAmount: boolean;
      stakeAmountGreaterThanMax: boolean;
      stakeAmountLessThanMin: boolean;
      stakeAmountIsZero: boolean;
    };
  };
  pointsRewardTokens: Maybe<TokenDto[]>;
  selectTokenIsLoading: boolean;
  selectYieldIsLoading: boolean;
  selectValidatorIsLoading: boolean;
  footerIsLoading: boolean;
  stakeMaxAmount: Maybe<number>;
  stakeMinAmount: Maybe<number>;
  validatorsData: Maybe<ValidatorDto[]>;
  isStakeTokenSameAsGasToken: boolean;
};
