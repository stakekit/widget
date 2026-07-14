import { Array as EArray } from "effect";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../schema/earn-models";
import type { ValidatorKey } from "./validators";

export type YieldRewardRateDto = NonNullable<
  EarnYieldWithProvider["rewardRate"]
>;
type YieldRewardDto = YieldRewardRateDto["components"][number];
type YieldWithRewardRate = Pick<EarnYieldWithProvider, "rewardRate">;
type ValidatorRewardRateDto = NonNullable<EarnValidator["rewardRate"]>;
export type SelectedValidators =
  | ReadonlyArray<EarnValidator>
  | ReadonlyMap<ValidatorKey, EarnValidator>;

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

const getYieldRewardRateDetails = (
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

  if (!EArray.isArrayNonEmpty(rewardRates)) return undefined;
  if (rewardRates.length === 1) return EArray.headNonEmpty(rewardRates);

  return averageRewardRates(rewardRates);
};

const averageRewardRates = (
  rewardRates: EArray.NonEmptyArray<ValidatorRewardRateDto>
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
  }, new Map<string, { component: YieldRewardDto; rate: number }>());

  return {
    total:
      rewardRates.reduce((acc, rewardRate) => acc + rewardRate.total, 0) /
      rewardRates.length,
    rateType: EArray.headNonEmpty(rewardRates).rateType,
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
