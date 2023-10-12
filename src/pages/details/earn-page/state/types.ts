import { Maybe } from "purify-ts";
import { SelectedStakeData } from "../types";
import { ExtraData, State } from "../../../../state/stake/types";
import {
  TokenBalanceScanResponseDto,
  ValidatorDto,
  YieldType,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { SelectModalProps } from "../../../../components";
import { useProviderDetails } from "../../../../hooks/use-provider-details";

export type DetailsContextType = {
  availableTokens: string;
  formattedPrice: string;
  symbol: string;
  selectedStakeData: Maybe<SelectedStakeData>;
  selectedStake: ExtraData["selectedStake"];
  onYieldSelect: (yieldId: string) => void;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
  onStakeAmountChange: (value: Maybe<BigNumber>) => void;
  estimatedRewards: Maybe<{
    percentage: string;
    yearly: string;
    monthly: string;
  }>;
  yieldType: string;
  onMaxClick: () => void;
  stakeAmount: State["stakeAmount"];
  isFetching: boolean;
  amountValid: boolean;
  buttonDisabled: boolean;
  onClick: () => void;
  onYieldSearch: SelectModalProps["onSearch"];
  onValidatorSelect: (item: ValidatorDto) => void;
  selectedValidator: State["selectedValidator"];
  isError: boolean;
  errorMessage: string;
  rewardToken: Maybe<{
    logoUri: string;
    symbol: string;
    providerName: string;
  }>;
  onSelectOpportunityClose: () => void;
  onStakeEnterIsLoading: boolean;
  selectedStakeYieldType: YieldType | null;
  isConnected: boolean;
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
  showTokenAmount: boolean;
  buttonCTAText: string;
  providerDetails: ReturnType<typeof useProviderDetails>;
  canStake: boolean;
};
