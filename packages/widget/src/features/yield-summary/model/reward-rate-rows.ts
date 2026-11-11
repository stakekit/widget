import {
  getCampaignIncentiveRate,
  getRewardRateBreakdown,
  type RewardRateBreakdownItem,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import { exactZero } from "../../../domain/finance/exact";

/**
 * The rows a rate composition shows: the rate's own parts and, for a yield
 * with a campaign, the campaign's row, added when the rate holds no campaign
 * part yet. Without parts of its own, the yield's own rate is what the
 * campaign doesn't add, so a campaign-only rate never reads as native.
 */
export const getRewardRateRows = (
  rewardRate: YieldRewardRate | null | undefined,
  showUpToCampaign: boolean,
  /** The campaign's rate type; undefined when the yield has no campaign. */
  campaign: { readonly rateType: string | null } | undefined
): ReadonlyArray<RewardRateBreakdownItem> => {
  const items = getRewardRateBreakdown(rewardRate, { showUpToCampaign });
  if (!campaign || !rewardRate) return items;

  const ownParts = items.filter((item) => item.key !== "campaign");
  const nativeRate = rewardRate.total.minus(
    getCampaignIncentiveRate(rewardRate)
  );
  const parts: ReadonlyArray<RewardRateBreakdownItem> = ownParts.length
    ? ownParts
    : [
        {
          key: "native",
          rate: nativeRate.isNegative() ? exactZero() : nativeRate,
          rewardType: rewardRate.rateType,
          isUpTo: false,
        },
      ];
  const campaignItem: RewardRateBreakdownItem = {
    key: "campaign",
    rate: rewardRate.total,
    rewardType: campaign.rateType ?? undefined,
    isUpTo: false,
  };

  return [...parts, campaignItem];
};
