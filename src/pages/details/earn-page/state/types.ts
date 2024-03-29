import { Maybe } from "purify-ts";
import { SelectedStakeData } from "../types";
import { ExtraData, State } from "../../../../state/stake/types";
import {
  TokenBalanceScanResponseDto,
  TronResourceType,
  ValidatorDto,
  YieldType,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import { SettingsContextType } from "../../../../providers/settings";

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
  errorMessage: string;
  rewardToken: ReturnType<typeof useRewardTokenDetails>;
  onSelectOpportunityClose: () => void;
  onStakeEnterIsLoading: boolean;
  selectedStakeYieldType: YieldType | null;
  isConnected: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  appLoading: boolean;
  multiYieldsLoading: boolean;
  yieldOpportunityLoading: boolean;
  stakeTokenAvailableAmountLoading: boolean;
  tokenBalancesScanLoading: boolean;
  selectedTokenBalance: State["selectedTokenBalance"];
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
      amountZero: boolean;
      amountInvalid: boolean;
    };
  };
};
