import type BigNumber from "bignumber.js";
import type { Maybe } from "purify-ts";
import type { KycGate } from "../../../../domain/types/kyc";
import type { TokenDto } from "../../../../domain/types/tokens";
import type { TronResourceType } from "../../../../domain/types/tron";
import type {
  DashboardYieldCategory,
  Yield,
} from "../../../../domain/types/yields";
import type { ValidatorDto } from "../../../../generated/api/yield";
import type { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import type { useProvidersDetails } from "../../../../hooks/use-provider-details";
import type { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import type { PageCta } from "../../../components/page-cta";
import type { SelectedStakeData } from "../types";
import type {
  EarnMachineStatus,
  EarnMachineView,
  EarnTokenOption,
} from "./effect-atom-poc/types";

export type EarnPageContextType = {
  machine: EarnMachineView;
  machineStatus: EarnMachineStatus;
  cta: PageCta;
  selectedTokenAvailableAmount: Maybe<{
    symbol: string;
    shortFormattedAmount: string;
    fullFormattedAmount: string;
    amount: BigNumber;
  }>;
  formattedPrice: string;
  symbol: string;
  rewardsTokenSymbol: string;
  selectedStakeData: Maybe<SelectedStakeData>;
  selectedStake: Maybe<Yield>;
  selectedProviderYieldId: Maybe<Yield["id"]>;
  selectedDashboardYieldCategory: DashboardYieldCategory | null;
  availableDashboardYieldCategories: DashboardYieldCategory[];
  onDashboardYieldCategorySelect: (category: DashboardYieldCategory) => void;
  onYieldSelect: (yieldId: string) => void;
  onTokenBalanceSelect: (tokenBalance: EarnTokenOption) => void;
  onStakeAmountChange: (value: BigNumber) => void;
  onProviderYieldIdSelect: (yieldId: Yield["id"]) => void;
  estimatedRewards: ReturnType<typeof useEstimatedRewards>;
  yieldType: string;
  onMaxClick: () => void;
  stakeAmount: BigNumber;
  isFetching: boolean;
  buttonDisabled: boolean;
  onClick: () => void;
  kycGate: KycGate;
  kycGateIsBlocking: boolean;
  kycGateIsChecking: boolean;
  kycProviderName: string | null;
  onKycStatusRefresh: () => void;
  onYieldSearch: (value: string) => void;
  onValidatorSelect: (item: ValidatorDto) => void;
  onValidatorRemove: (item: ValidatorDto) => void;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  isError: boolean;
  rewardToken: ReturnType<typeof useRewardTokenDetails>;
  onSelectOpportunityClose: () => void;
  onSelectTokenClose: () => void;
  isConnected: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  appLoading: boolean;
  yieldOpportunityLoading: boolean;
  tokenBalancesScanLoading: boolean;
  selectedToken: Maybe<TokenDto>;
  tokenBalancesData: Maybe<{
    all: EarnTokenOption[];
    filtered: EarnTokenOption[];
  }>;
  onTokenSearch: (value: string) => void;
  onValidatorSearch: (value: string) => void;
  validatorSearch: string;
  buttonCTAText: string;
  providersDetails: ReturnType<typeof useProvidersDetails>;
  tokenSearch: string;
  stakeSearch: string;
  defaultTokensIsLoading: boolean;
  tronResource: Maybe<TronResourceType>;
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
  pointsRewardTokens: Maybe<(TokenDto & { isPoints?: boolean })[]>;
  selectTokenIsLoading: boolean;
  selectYieldIsLoading: boolean;
  selectValidatorIsLoading: boolean;
  footerIsLoading: boolean;
  stakeMaxAmount: Maybe<number>;
  stakeMinAmount: Maybe<number>;
  validatorsData: Maybe<ValidatorDto[]>;
  hasMoreValidators: boolean;
  hasMoreTokens: boolean;
  isLoadingMoreValidators: boolean;
  isLoadingMoreTokens: boolean;
  onLoadMoreValidators: () => void;
  onLoadMoreTokens: () => void;
  isStakeTokenSameAsGasToken: boolean;
};
