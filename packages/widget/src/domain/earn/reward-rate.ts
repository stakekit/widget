import type BigNumber from "bignumber.js";
import { Array as EArray } from "effect";

import { exactDecimal, exactZero } from "../finance/exact";
import type { DisplayedCampaign, YieldCampaign } from "./campaign";
import type { EarnValidator, EarnValidatorKey } from "./validator";
import type { EarnYield, EarnYieldWithProvider } from "./yield-schema";

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

/** Where a part of a Rate Composition comes from. */
type RatePartSource =
  /** As the rate lists it. */
  | "listed"
  /** What the incentives leave of the total, for a rate listing no own part. */
  | "remainder"
  /**
   * The earning Campaign's own rate, which the API's rate doesn't list yet:
   * the API serves yields from a longer cache than campaigns. The total has
   * it, added here or by `withCampaignRate`.
   */
  | "campaign"
  /** An upcoming Campaign's rate, which today's total doesn't have yet. */
  | "planned";

type SourcedRatePart<Source extends RatePartSource> = RatePart & {
  readonly source: Source;
};

/**
 * A reward rate split into what the widget shows: the yield's own rate,
 * protocol incentives and the Campaign Incentive Rate, each as the rate lists
 * it or from where else it comes, and the total as given. A rate listing no
 * own part has as its own what the incentives leave of the total, so a
 * campaign-only rate never reads as the yield's own.
 */
export type RateComposition = {
  readonly native: SourcedRatePart<"listed" | "remainder">;
  readonly protocolIncentive: SourcedRatePart<"listed"> | null;
  readonly campaign: SourcedRatePart<"listed" | "campaign" | "planned"> | null;
  /** The total as given, with an earning Campaign's own rate when added. */
  readonly total: RatePart;
  /** The total with the campaign part in it, from the start when planned. */
  readonly withCampaign: BigNumber;
};

const isIncentive = (yieldSource: YieldSource) =>
  yieldSource === "protocol_incentive" || yieldSource === "campaign_incentive";

// How far listed parts may sum from their total and still make it up: the
// API rounds some yields' parts by up to ~1e-10, far below any campaign rate.
const partsSumTolerance = exactDecimal("1e-8");

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

const asListed = (part: RatePart | null) =>
  part && { ...part, source: "listed" as const };

/**
 * The campaign part as the shown campaign stands: while it earns, the part
 * the rate lists, else its own rate when the listed parts make up the total
 * (else a dropped part may be it); before it starts, its planned rate;
 * while paused, none. Without a shown campaign, the part the rate lists.
 */
const getCampaignPart = (
  listed: SourcedRatePart<"listed" | "campaign"> | null,
  partsMakeUpTotal: boolean,
  shown: DisplayedCampaign | null
): RateComposition["campaign"] => {
  if (!shown) return listed;
  const own = shown.campaign.rewardRate;
  const ownPart = own?.total.isGreaterThan(0)
    ? { rate: own.total, rateType: own.rateType }
    : null;
  switch (shown.lifecycle) {
    case "paused":
      return null;
    case "upcoming":
      return ownPart && { ...ownPart, source: "planned" };
    case "active":
    case "ending_soon":
      if (listed) return listed;
      return ownPart && partsMakeUpTotal
        ? { ...ownPart, source: "campaign" }
        : null;
  }
};

/**
 * A yield's Rate Composition as its shown Campaign stands, or as the rate
 * lists it without one. The one projection every rate reader shares.
 */
export const getRateComposition = (
  rewardRate: YieldRewardRate,
  shownCampaign: DisplayedCampaign | null
): RateComposition => {
  const { components, total } = rewardRate;
  const from = (yieldSource: YieldSource) =>
    sumComponents(
      components.filter((component) => component.yieldSource === yieldSource)
    );
  const protocolIncentive = from("protocol_incentive");
  const campaignComponents = components.filter(
    (component) => component.yieldSource === "campaign_incentive"
  );
  const listedCampaignRate = sumComponents(campaignComponents);
  const listedCampaign = listedCampaignRate && {
    ...listedCampaignRate,
    source: campaignComponents.some(({ origin }) => origin === "campaign")
      ? ("campaign" as const)
      : ("listed" as const),
  };
  const listedNative = sumComponents(
    components.filter((component) => !isIncentive(component.yieldSource))
  );
  const leftNative = total
    .minus(protocolIncentive?.rate ?? 0)
    .minus(listedCampaign?.rate ?? 0);
  // Whether the listed parts make up the given total, to the API's rounding:
  // a part decoding dropped, such as a campaign part with a malformed token,
  // may be in a total they don't make up.
  const partsMakeUpTotal = components
    .reduce((sum, component) => sum.plus(component.rate), exactZero())
    .minus(total)
    .abs()
    .isLessThanOrEqualTo(partsSumTolerance);
  const campaign = getCampaignPart(
    listedCampaign,
    partsMakeUpTotal,
    shownCampaign
  );
  // The campaign's own rate, when the rate lists no campaign part.
  const withAdded = total.plus(
    campaign?.source === "campaign" && !listedCampaign ? campaign.rate : 0
  );

  return {
    native: listedNative
      ? { ...listedNative, source: "listed" }
      : {
          rate: leftNative.isNegative() ? exactZero() : leftNative,
          rateType: rewardRate.rateType,
          source: "remainder",
        },
    protocolIncentive: asListed(protocolIncentive),
    campaign,
    total: { rate: withAdded, rateType: rewardRate.rateType },
    withCampaign: withAdded.plus(
      campaign?.source === "planned" ? campaign.rate : 0
    ),
  };
};

/**
 * A yield with its earning campaign's Campaign Incentive Rate added, tagged
 * as the campaign's, when its Rate Composition adds it, so every reader of
 * the yield's rate, such as its list and sort order, has it.
 */
export const withCampaignRate = <Y extends Pick<EarnYield, "rewardRate">>(
  yieldDto: Y,
  campaign: YieldCampaign
): Y => {
  const { rewardRate } = yieldDto;
  const composition = getRateComposition(rewardRate, {
    campaign,
    lifecycle: "active",
  });
  const part = composition.campaign;
  const own = campaign.rewardRate;
  if (
    !own ||
    part?.source !== "campaign" ||
    composition.total.rate.isEqualTo(rewardRate.total)
  ) {
    return yieldDto;
  }
  const added: YieldRewardDto = {
    rate: part.rate,
    rateType: own.rateType,
    token: campaign.rewardToken,
    yieldSource: "campaign_incentive",
    origin: "campaign",
  };

  return {
    ...yieldDto,
    rewardRate: {
      ...rewardRate,
      total: composition.total.rate,
      components: [...rewardRate.components, added],
    },
  };
};
