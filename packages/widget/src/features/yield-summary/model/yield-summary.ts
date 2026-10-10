import type BigNumber from "bignumber.js";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ValidatorKey } from "../../../domain/earn/validator";
import {
  getExtendedYieldType,
  getYieldRewardTokens,
} from "../../../domain/earn/yield";
import { getRewardRateFormatted } from "../../../shared/lib/formatters";

export type YieldSummaryProvider = Readonly<{
  readonly address?: EarnValidator["address"];
  readonly commission?: EarnValidator["commission"];
  readonly logo: string | undefined;
  readonly name: string;
  readonly preferred?: EarnValidator["preferred"];
  readonly rewardRate: BigNumber | undefined;
  readonly rewardRateFormatted: string;
  readonly rewardType: string | undefined;
  readonly stakedBalance?: EarnValidator["tvl"];
  readonly status?: EarnValidator["status"];
  readonly votingPower?: EarnValidator["votingPower"];
  readonly website?: EarnValidator["website"];
}>;

export type YieldSummaryInput = Readonly<{
  readonly validators:
    | ReadonlyMap<ValidatorKey, EarnValidator>
    | ReadonlyArray<EarnValidator>
    | null;
  readonly yield: EarnYieldWithProvider | null;
}>;

export type YieldSummaryRewardToken = Readonly<{
  readonly logoUri: string | undefined;
  readonly providerName: string;
  readonly rewardTokens: ReturnType<typeof getYieldRewardTokens>;
}>;

const getValidatorProvider = (
  selectedYield: EarnYieldWithProvider,
  validator: EarnValidator
): YieldSummaryProvider => {
  const rewardRate = validator.rewardRate?.total;
  return {
    address: validator.address,
    commission: validator.commission,
    logo: validator.logoURI,
    name: validator.name ?? validator.address,
    preferred: validator.preferred,
    rewardRate,
    rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    stakedBalance: validator.tvl,
    status: validator.status,
    votingPower: validator.votingPower,
    website: validator.website,
  };
};

const getYieldProvider = (
  selectedYield: EarnYieldWithProvider
): YieldSummaryProvider => {
  const rewardRate = selectedYield.rewardRate.total;
  const provider = selectedYield.provider;
  return {
    logo: provider?.logoURI ?? selectedYield.metadata.logoURI,
    name: provider?.name ?? selectedYield.metadata.name,
    rewardRate,
    rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    website: provider?.website,
  };
};

const getYieldSummaryProviders = ({
  validators,
  yield: selectedYield,
}: YieldSummaryInput): YieldSummaryProvider[] | null => {
  if (!validators || !selectedYield) return null;

  const values = Array.isArray(validators)
    ? validators
    : [...(validators as ReadonlyMap<ValidatorKey, EarnValidator>).values()];
  if (values.length === 0) return [getYieldProvider(selectedYield)];

  return values.map((validator) =>
    getValidatorProvider(selectedYield, validator)
  );
};

export const getYieldSummaryRewardToken = (
  selectedYield: EarnYieldWithProvider | null
): YieldSummaryRewardToken | null => {
  const provider = selectedYield?.provider;
  if (!selectedYield || !provider) return null;
  const rewardTokens = getYieldRewardTokens(selectedYield);

  return {
    logoUri: provider.logoURI,
    providerName: provider.name,
    rewardTokens,
  } as const;
};

export const resolveYieldSummaryView = (input: YieldSummaryInput) => {
  const selectedYield = input.yield;

  return {
    providers: getYieldSummaryProviders(input),
    rewardToken: getYieldSummaryRewardToken(selectedYield),
    yieldType: selectedYield ? getExtendedYieldType(selectedYield) : null,
  } as const;
};
