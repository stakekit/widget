import { useSummary } from "../../../hooks/use-summary";

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
