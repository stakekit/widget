import { useSummary } from "@sk-widget/hooks/use-summary";

export const useRewardDetails = () => {
  const {
    allPositionsQuery,
    // rewardsPositionsQuery
  } = useSummary();

  return {
    allPositionsQuery,
    // rewardsPositionsQuery,
  };
};
