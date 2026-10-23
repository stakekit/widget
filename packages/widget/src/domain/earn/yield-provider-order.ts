import type { DashboardYieldCategory } from "./contract";
import type { EarnYieldWithProvider } from "./models";
import {
  type ExtendedYieldType,
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldTypesSortRank,
  isNonZeroRewardRateYield,
} from "./yield";

/**
 * Yield provider IDs to list first, per dashboard category, in rank order.
 * A category without an entry keeps the default yield order.
 */
export type YieldProviderOrder = Readonly<
  Partial<Record<DashboardYieldCategory, ReadonlyArray<string>>>
>;

const unranked = Number.MAX_SAFE_INTEGER;

const makeProviderRank = (order: YieldProviderOrder) => {
  const ranks = new Map<string, number>();
  for (const [category, providerIds] of Object.entries(order)) {
    for (const [index, providerId] of (providerIds ?? []).entries()) {
      const key = `${category}:${providerId}`;
      if (!ranks.has(key)) ranks.set(key, index);
    }
  }

  return (yieldDto: EarnYieldWithProvider) =>
    ranks.get(
      `${getDashboardYieldCategory(yieldDto)}:${yieldDto.providerId}`
    ) ?? unranked;
};

/**
 * Orders yields by type group, then ranked provider, then reward rate.
 *
 * A type group holding a ranked provider moves ahead of the default type
 * order, by its best rank, so ranked providers lead while groups stay
 * contiguous. Yields of one provider keep their reward-rate order, and
 * unranked providers follow the ranked ones.
 */
export const orderYieldsByProvider = <Yield extends EarnYieldWithProvider>(
  yields: ReadonlyArray<Yield>,
  order: YieldProviderOrder
): Yield[] => {
  const providerRank = makeProviderRank(order);
  const groupRank = new Map<ExtendedYieldType, number>();
  for (const yieldDto of yields) {
    const type = getExtendedYieldType(yieldDto);
    groupRank.set(
      type,
      Math.min(groupRank.get(type) ?? unranked, providerRank(yieldDto))
    );
  }
  const groupRankOf = (yieldDto: Yield) =>
    groupRank.get(getExtendedYieldType(yieldDto)) ?? unranked;

  return yields.toSorted(
    (left, right) =>
      groupRankOf(left) - groupRankOf(right) ||
      getYieldTypesSortRank(left) - getYieldTypesSortRank(right) ||
      providerRank(left) - providerRank(right) ||
      (right.rewardRate.total.comparedTo(left.rewardRate.total) ?? 0)
  );
};

/**
 * The best-ranked provider's yield that is open to deposits with a reward
 * rate, first in list order among that provider's yields; `null` without one.
 */
export const getRankedDefaultYield = <Yield extends EarnYieldWithProvider>(
  yields: ReadonlyArray<Yield>,
  order: YieldProviderOrder
): Yield | null => {
  const providerRank = makeProviderRank(order);
  const [best] = orderYieldsByProvider(
    yields.filter(
      (yieldDto) =>
        providerRank(yieldDto) !== unranked &&
        yieldDto.status.enter &&
        isNonZeroRewardRateYield(yieldDto)
    ),
    order
  ).toSorted((left, right) => providerRank(left) - providerRank(right));
  return best ?? null;
};
