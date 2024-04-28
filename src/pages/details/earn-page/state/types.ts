import type { Maybe } from "purify-ts";
import type { SelectedStakeData } from "../types";
import type { ExtraData, State } from "../../../../state/stake/types";
import type {
  TokenBalanceScanResponseDto,
  TokenDto,
  TronResourceType,
  ValidatorDto,
  YieldType,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { useProvidersDetails } from "../../../../hooks/use-provider-details";
import type { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import type { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import type { SettingsContextType } from "../../../../providers/settings";

export type DetailsContextType = {
  referralCheck: SettingsContextType["referralCheck"];
  availableTokens: string;
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
  onStakeEnterIsLoading: boolean;
  selectedStakeYieldType: YieldType | null;
  isConnected: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  appLoading: boolean;
  multiYieldsLoading: boolean;
  yieldOpportunityLoading: boolean;
  tokenBalancesScanLoading: boolean;
  selectedToken: State["selectedToken"];
  tokenBalancesData: Maybe<{
    all: TokenBalanceScanResponseDto[];
    filtered: TokenBalanceScanResponseDto[];
  }>;
  onTokenSearch: (value: string) => void;
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
};
