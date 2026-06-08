import type {
  RewardDto,
  ValidatorDto,
  YieldDto,
} from "../../generated/api/yield";

type YieldRewardDto = RewardDto;
export type YieldRewardRateDto = NonNullable<YieldDto["rewardRate"]>;
type YieldWithRewardRate = Pick<YieldDto, "rewardRate">;
type ValidatorRewardRateDto = NonNullable<ValidatorDto["rewardRate"]>;
export type SelectedValidators =
  | ReadonlyArray<ValidatorDto>
  | ReadonlyMap<ValidatorDto["address"], ValidatorDto>;

type RewardRateBreakdownKey = "native" | "protocol_incentive" | "campaign";

export type RewardRateBreakdownItem = {
  key: RewardRateBreakdownKey;
  rate: number;
  rewardType: string | undefined;
  isUpTo: boolean;
};

const breakdownOrder: RewardRateBreakdownKey[] = [
  "native",
  "protocol_incentive",
  "campaign",
];

const getBreakdownKey = (
  yieldSource: YieldRewardDto["yieldSource"]
): RewardRateBreakdownKey =>
  yieldSource === "campaign_incentive"
    ? "campaign"
    : yieldSource === "protocol_incentive"
      ? "protocol_incentive"
      : "native";

export const getYieldRewardRateDetails = (
  yieldDto: YieldWithRewardRate | null | undefined
): YieldRewardRateDto | undefined => yieldDto?.rewardRate;

export const getEffectiveYieldRewardRateDetails = ({
  selectedValidators,
  yieldDto,
}: {
  selectedValidators?: SelectedValidators | null;
  yieldDto: YieldWithRewardRate | null | undefined;
}): YieldRewardRateDto | ValidatorRewardRateDto | undefined =>
  getSelectedValidatorsRewardRate(selectedValidators) ??
  getYieldRewardRateDetails(yieldDto);

const getSelectedValidatorsRewardRate = (
  selectedValidators: SelectedValidators | null | undefined
) => {
  const validators = selectedValidators
    ? selectedValidators instanceof Map
      ? [...selectedValidators.values()]
      : [...selectedValidators]
    : [];
  const rewardRates = validators.flatMap((validator) =>
    validator.rewardRate ? [validator.rewardRate] : []
  );

  if (rewardRates.length < 2) {
    return rewardRates[0];
  }

  return averageRewardRates(rewardRates);
};

const averageRewardRates = (
  rewardRates: ValidatorRewardRateDto[]
): ValidatorRewardRateDto => {
  const componentsByKey = rewardRates.reduce((acc, rewardRate) => {
    rewardRate.components.forEach((component) => {
      const key = `${component.yieldSource}:${component.rateType}:${component.token.symbol}`;
      const prev = acc.get(key);

      acc.set(key, {
        component,
        rate: (prev?.rate ?? 0) + component.rate,
      });
    });

    return acc;
  }, new Map<string, { component: RewardDto; rate: number }>());

  return {
    total:
      rewardRates.reduce((acc, rewardRate) => acc + rewardRate.total, 0) /
      rewardRates.length,
    rateType: rewardRates[0].rateType,
    components: [...componentsByKey.values()].map(({ component, rate }) => ({
      ...component,
      rate: rate / rewardRates.length,
    })),
  };
};

export const getRewardRateBreakdown = (
  rewardRate: YieldRewardRateDto | null | undefined,
  opts?: {
    showUpToCampaign?: boolean;
  }
): RewardRateBreakdownItem[] => {
  if (!rewardRate?.components?.length) {
    return [];
  }

  const buckets = rewardRate.components.reduce((acc, component) => {
    const key = getBreakdownKey(component.yieldSource);
    const prev = acc.get(key);

    acc.set(key, {
      key,
      rate: (prev?.rate ?? 0) + component.rate,
      rewardType: prev?.rewardType ?? component.rateType,
      isUpTo: key === "campaign" && !!opts?.showUpToCampaign,
    });

    return acc;
  }, new Map<RewardRateBreakdownKey, RewardRateBreakdownItem>());

  return breakdownOrder.flatMap((key) => {
    const item = buckets.get(key);

    return item && item.rate > 0 ? [item] : [];
  });
};
