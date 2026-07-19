import type BigNumber from "bignumber.js";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../domain/schema/earn-models";
import type {
  AppToken,
  TronResource,
} from "../../../../../../domain/schema/legacy-models";
import type { KycGate } from "../../../../../../domain/types/kyc";

import type { ValidatorKey } from "../../../../../../domain/types/validators";
import type { DashboardYieldCategory } from "../../../../../../public-api/types";
import type { PageCta } from "../../../../../widget-shell/page-cta";
import type { useEstimatedRewards } from "../../../../react/use-estimated-rewards";
import type { useProvidersDetails } from "../../../../react/use-provider-details";
import type { useRewardTokenDetails } from "../../../../react/use-reward-token-details";
import type {
  EarnMachineStatus,
  EarnMachineView,
  EarnTokenOption,
} from "../../../../state/atoms-state/types";
import type { SelectedStakeData } from "../types";

export type EarnPageModel = {
  machine: EarnMachineView;
  machineStatus: EarnMachineStatus;
  cta: PageCta;
  selectedTokenAvailableAmount: {
    symbol: string;
    shortFormattedAmount: string;
    fullFormattedAmount: string;
    amount: BigNumber;
  } | null;
  formattedPrice: string;
  symbol: string;
  rewardsTokenSymbol: string;
  selectedStakeData: SelectedStakeData;
  selectedStake: EarnYieldWithProvider | null;
  selectedProviderYieldId: EarnYieldWithProvider["id"] | null;
  selectedDashboardYieldCategory: DashboardYieldCategory | null;
  availableDashboardYieldCategories: DashboardYieldCategory[];
  onDashboardYieldCategorySelect: (category: DashboardYieldCategory) => void;
  onYieldSelect: (yieldId: EarnYieldWithProvider["id"]) => void;
  onTokenBalanceSelect: (tokenBalance: EarnTokenOption) => void;
  onStakeAmountChange: (value: BigNumber) => void;
  onProviderYieldIdSelect: (yieldId: EarnYieldWithProvider["id"]) => void;
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
  onValidatorSelect: (item: EarnValidator) => void;
  onValidatorRemove: (item: EarnValidator) => void;
  selectedValidators: Map<ValidatorKey, EarnValidator>;
  isError: boolean;
  rewardToken: ReturnType<typeof useRewardTokenDetails>;
  onSelectOpportunityClose: () => void;
  onSelectTokenClose: () => void;
  isConnected: boolean;
  isLedgerLiveAccountPlaceholder: boolean;
  appLoading: boolean;
  yieldOpportunityLoading: boolean;
  selectedToken: AppToken | null;
  tokenBalancesData: {
    all: EarnTokenOption[];
    filtered: EarnTokenOption[];
  };
  onTokenSearch: (value: string) => void;
  onValidatorSearch: (value: string) => void;
  validatorSearch: string;
  buttonCTAText: string;
  providersDetails: ReturnType<typeof useProvidersDetails>;
  tokenSearch: string;
  stakeSearch: string;
  tronResource: TronResource | null;
  onTronResourceSelect: (value: TronResource) => void;
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
  pointsRewardTokens: (AppToken & { isPoints?: boolean })[] | null;
  selectTokenIsLoading: boolean;
  selectYieldIsLoading: boolean;
  selectValidatorIsLoading: boolean;
  footerIsLoading: boolean;
  stakeMaxAmount: number | null;
  stakeMinAmount: number | null;
  validatorsData: EarnValidator[] | null;
  hasMoreValidators: boolean;
  hasMoreTokens: boolean;
  isLoadingMoreValidators: boolean;
  isLoadingMoreTokens: boolean;
  onLoadMoreValidators: () => void;
  onLoadMoreTokens: () => void;
  isStakeTokenSameAsGasToken: boolean;
};
