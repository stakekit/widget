import type BigNumber from "bignumber.js";
import { Array as EArray } from "effect";

import { exactZero } from "../finance/exact";
import type { EarnValidator, EarnValidatorKey } from "./validator";
import type { EarnYieldWithProvider } from "./yield-schema";

export type YieldRewardRate = NonNullable<EarnYieldWithProvider["rewardRate"]>;
type YieldRewardDto = YieldRewardRate["components"][number];
type YieldSource = YieldRewardDto["yieldSource"];
type YieldWithRewardRate = Pick<EarnYieldWithProvider, "rewardRate">;
type ValidatorRewardRateDto = NonNullable<EarnValidator["rewardRate"]>;
export type SelectedValidators =
  | ReadonlyArray<EarnValidator>
  | ReadonlyMap<EarnValidatorKey, EarnValidator>;

const isSelectedValidatorMap = (
  validators: SelectedValidators
): validators is ReadonlyMap<EarnValidatorKey, EarnValidator> =>
  validators instanceof Map;

const getSelectedValidators = (
  selectedValidators: SelectedValidators | null | undefined
): ReadonlyArray<EarnValidator> => {
  if (!selectedValidators) return [];
  if (isSelectedValidatorMap(selectedValidators)) {
    return [...selectedValidators.values()];
  }
  return selectedValidators;
};

const getYieldRewardRateDetails = (
  yieldDto: YieldWithRewardRate | null | undefined
): YieldRewardRate | undefined => yieldDto?.rewardRate;

export const getEffectiveYieldRewardRateDetails = ({
  selectedValidators,
  yieldDto,
}: {
  selectedValidators?: SelectedValidators | null;
  yieldDto: YieldWithRewardRate | null | undefined;
}): YieldRewardRate | undefined =>
  getSelectedValidatorsRewardRate(selectedValidators) ??
  getYieldRewardRateDetails(yieldDto);

const getSelectedValidatorsRewardRate = (
  selectedValidators: SelectedValidators | null | undefined
) => {
  const validators = getSelectedValidators(selectedValidators);
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
        rate: (prev?.rate ?? exactZero()).plus(component.rate),
      });
    });

    return acc;
  }, new Map<string, { component: YieldRewardDto; rate: BigNumber }>());

  return {
    total: rewardRates
      .reduce((acc, rewardRate) => acc.plus(rewardRate.total), exactZero())
      .dividedBy(rewardRates.length),
    rateType: EArray.headNonEmpty(rewardRates).rateType,
    components: [...componentsByKey.values()].map(({ component, rate }) => ({
      ...component,
      rate: rate.dividedBy(rewardRates.length),
    })),
  };
};

/** A part of a reward rate, in its own rate type ("APY", "APR"). */
export type RatePart = {
  readonly rate: BigNumber;
  readonly rateType: string | undefined;
};

/**
 * A reward rate split into what the widget shows: the yield's own rate,
 * protocol incentives and the Campaign Incentive Rate, each as the rate lists
 * it, and the total as given. A rate listing no own part has as its own what
 * the incentives leave of the total, so a campaign-only rate never reads as
 * the yield's own.
 */
export type RateComposition = {
  readonly native: RatePart;
  readonly protocolIncentive: RatePart | null;
  readonly campaign: RatePart | null;
  readonly total: RatePart;
};

const isIncentive = (yieldSource: YieldSource) =>
  yieldSource === "protocol_incentive" || yieldSource === "campaign_incentive";

// The components summed in the first one's rate type; null when they add
// nothing.
const sumComponents = (
  components: YieldRewardRate["components"]
): RatePart | null => {
  const rate = components.reduce(
    (total, component) => total.plus(component.rate),
    exactZero()
  );
  return rate.isGreaterThan(0)
    ? { rate, rateType: components[0]?.rateType }
    : null;
};

export const getRateComposition = (
  rewardRate: YieldRewardRate
): RateComposition => {
  const { components, total } = rewardRate;
  const from = (yieldSource: YieldSource) =>
    sumComponents(
      components.filter((component) => component.yieldSource === yieldSource)
    );
  const protocolIncentive = from("protocol_incentive");
  const campaign = from("campaign_incentive");
  const listedNative = sumComponents(
    components.filter((component) => !isIncentive(component.yieldSource))
  );
  const leftNative = total
    .minus(protocolIncentive?.rate ?? 0)
    .minus(campaign?.rate ?? 0);

  return {
    native: listedNative ?? {
      rate: leftNative.isNegative() ? exactZero() : leftNative,
      rateType: rewardRate.rateType,
    },
    protocolIncentive,
    campaign,
    total: { rate: total, rateType: rewardRate.rateType },
  };
};
